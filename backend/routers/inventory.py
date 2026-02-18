from fastapi import APIRouter, HTTPException, Depends, Body
from sqlalchemy.orm import Session
from backend.database import get_db, redis_client, mongo_db
from backend.models.inventory import ItemModel
from backend.schemas.inventory import ItemCreate, Laboratory
from bson import ObjectId
import json
from typing import List, Dict
import uuid # Para generar IDs unicos para los items de mongo

router = APIRouter(prefix="/laboratories", tags=["Gestión Híbrida"])

# ==========================================
# 🟠 PARTE 1: MYSQL + REDIS (Inventario Global - Demo Circuit Breaker)
# ==========================================

@router.get("/items")
async def list_global_items(db: Session = Depends(get_db)):
    try:
        items = db.query(ItemModel).all()
        return {"source": "MySQL", "data": items}
    except Exception as e:
        print(f"⚠️ [MySQL CAÍDO] Leyendo respaldo de Redis: {e}")
        backup_raw = await redis_client.lrange("backup_items", 0, -1)
        if not backup_raw:
            return {"source": "REDIS_EMPTY", "data": [], "message": "No hay datos en respaldo"} 
        backup_items = [json.loads(i) for i in backup_raw]
        return {"source": "REDIS_CACHE", "message": "Modo de Emergencia Activado", "data": backup_items}

@router.post("/items")
async def create_global_item(item: ItemCreate, db: Session = Depends(get_db)):
    item_dict = item.model_dump()
    try:
        new_db_item = ItemModel(**item_dict)
        db.add(new_db_item)
        db.commit()
        db.refresh(new_db_item)
        return {"source": "MySQL", "status": "success", "data": item_dict}
    except Exception as e:
        print(f"⚠️ [MySQL FALLÓ] Guardando en Redis: {e}")
        await redis_client.lpush("backup_items", json.dumps(item_dict))
        return {"source": "REDIS_BACKUP", "status": "warning", "message": "BD Saturada. Guardado en memoria temporal.", "data": item_dict}
    
# EDITAR ITEM GLOBAL (MySQL)
@router.put("/items/{item_id}")
async def update_global_item(item_id: int, item: ItemCreate, db: Session = Depends(get_db)):
    # 1. Buscamos en MySQL
    db_item = db.query(ItemModel).filter(ItemModel.id == item_id).first()
    
    if not db_item:
        raise HTTPException(status_code=404, detail="Item no encontrado en MySQL")

    # 2. Actualizamos campos
    db_item.name = item.name # (En el modelo se llama name, en el esquema code/name)
    db_item.type = item.type
    db_item.status = item.status
    db_item.area = item.area
    
    try:
        db.commit()
        db.refresh(db_item)
        return {"source": "MySQL", "status": "updated", "data": item.model_dump()}
    except Exception as e:
        print(f"⚠️ Error actualizando MySQL: {e}")
        raise HTTPException(status_code=500, detail="Error de conexión con MySQL")

# ELIMINAR ITEM GLOBAL (MySQL)
@router.delete("/items/{item_id}")
async def delete_global_item(item_id: int, db: Session = Depends(get_db)):
    # 1. Buscamos en MySQL
    db_item = db.query(ItemModel).filter(ItemModel.id == item_id).first()
    
    if not db_item:
        raise HTTPException(status_code=404, detail="Item no encontrado")
    
    try:
        db.delete(db_item)
        db.commit()
        return {"source": "MySQL", "status": "deleted", "id": item_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al eliminar de MySQL: {e}")

# ==========================================
# 🟢 PARTE 2: MONGODB (Gestión Detallada de Laboratorios)
# ==========================================

@router.get("/", response_description="Listar laboratorios")
async def list_laboratories():
    laboratories = []
    cursor = mongo_db["laboratories"].find()
    async for document in cursor:
        document["id"] = str(document["_id"])
        del document["_id"]
        laboratories.append(document)
    return laboratories

@router.post("/", response_description="Crear laboratorio", status_code=201)
async def create_laboratory(lab: Laboratory):
    lab_dict = lab.model_dump(by_alias=True, exclude=["id"])
    if "items" not in lab_dict: lab_dict["items"] = [] # Asegurar que exista array
    new_lab = await mongo_db["laboratories"].insert_one(lab_dict)
    created_lab = await mongo_db["laboratories"].find_one({"_id": new_lab.inserted_id})
    created_lab["id"] = str(created_lab["_id"])
    del created_lab["_id"]
    return created_lab

@router.get("/{id}", response_description="Obtener un laboratorio")
async def get_laboratory(id: str):
    if not ObjectId.is_valid(id): raise HTTPException(status_code=400, detail="ID inválido")
    lab = await mongo_db["laboratories"].find_one({"_id": ObjectId(id)})
    if not lab: raise HTTPException(status_code=404, detail="Laboratorio no encontrado")
    lab["id"] = str(lab["_id"])
    del lab["_id"]
    return lab

# 7. ELIMINAR LABORATORIO (MONGO)
@router.delete("/{id}", response_description="Eliminar laboratorio")
async def delete_laboratory(id: str):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="ID inválido")
    
    result = await mongo_db["laboratories"].delete_one({"_id": ObjectId(id)})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Laboratorio no encontrado")
    
    return {"message": "Laboratorio eliminado correctamente"}

# --- ENDPOINT QUE FALTABA 1: AGREGAR ITEM A UN LAB (MONGO) ---
@router.put("/{id}/add-item")
async def add_item_to_lab(id: str, item: ItemCreate):
    # Generamos un ID único para el item dentro de Mongo
    new_item = item.model_dump()
    new_item["id"] = str(uuid.uuid4()) # ID único simulado
    new_item["maintenance_history"] = [] # Array vacío para mantenimientos

    result = await mongo_db["laboratories"].update_one(
        {"_id": ObjectId(id)},
        {"$push": {"items": new_item}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Laboratorio no encontrado")
    return {"message": "Máquina agregada a MongoDB", "item": new_item}

# --- ENDPOINT DE ACTUALIZAR (Ya lo tenías) ---
@router.put("/{lab_id}/items/{item_id}")
async def update_mongo_item(lab_id: str, item_id: str, item_data: ItemCreate):
    update_data = {
        "items.$.code": item_data.code,
        "items.$.type": item_data.type,
        "items.$.status": item_data.status,
        "items.$.area": item_data.area
    }
    result = await mongo_db["laboratories"].update_one(
        {"_id": ObjectId(lab_id), "items.id": item_id},
        {"$set": update_data}
    )
    if result.modified_count == 0:
         raise HTTPException(status_code=404, detail="Item no encontrado")
    return {"message": "Item actualizado"}

# --- ENDPOINT QUE FALTABA 2: AGREGAR MANTENIMIENTO (MONGO) ---
@router.post("/{lab_id}/items/{item_id}/maintenance")
async def add_maintenance(lab_id: str, item_id: str, maintenance: Dict = Body(...)):
    # maintenance viene como { "date": "...", "description": "..." }
    maintenance["id"] = str(uuid.uuid4())
    
    result = await mongo_db["laboratories"].update_one(
        {"_id": ObjectId(lab_id), "items.id": item_id},
        {"$push": {"items.$.maintenance_history": maintenance}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="No se pudo agregar mantenimiento")
    return {"message": "Mantenimiento registrado"}


# DELETE

@router.delete("/{lab_id}/items/{item_id}")
async def delete_item_from_lab(lab_id: str, item_id: str):
    """Elimina una máquina específica de un laboratorio"""
    if not ObjectId.is_valid(lab_id):
        raise HTTPException(status_code=400, detail="ID de laboratorio inválido")

    # Usamos $pull para sacar el item del array basado en su 'id' interno
    result = await mongo_db["laboratories"].update_one(
        {"_id": ObjectId(lab_id)},
        {"$pull": {"items": {"id": item_id}}}
    )

    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Máquina no encontrada o Laboratorio no existe")

    return {"message": "Máquina eliminada correctamente"}