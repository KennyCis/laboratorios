import { useEffect, useState } from "react";
import { 
    Container, Typography, TextField, Button, Paper, Table, TableBody, TableCell, 
    TableHead, TableRow, Chip, Box, Dialog, DialogTitle, DialogContent, DialogActions, 
    Alert, AlertTitle, IconButton // <--- AGREGADO
} from "@mui/material";
import AddCircleIcon from '@mui/icons-material/AddCircle';
import StorageIcon from '@mui/icons-material/Storage';
import EditIcon from '@mui/icons-material/Edit'; // <--- AGREGADO
import DeleteIcon from '@mui/icons-material/Delete'; // <--- AGREGADO
import api from "../api/axios";

function ReportPage() {
  const [items, setItems] = useState([]);
  const [source, setSource] = useState("Cargando..."); 
  const [search, setSearch] = useState("");
  
  // Estado para el modal de agregar
  const [open, setOpen] = useState(false);
  const [newItem, setNewItem] = useState({ code: "", type: "PC", status: "Operativa", area: "Sala 1" });
  const [saveStatus, setSaveStatus] = useState(null);

  // --- NUEVO: ESTADOS PARA EDITAR ---
  const [openEdit, setOpenEdit] = useState(false);
  const [editItem, setEditItem] = useState({ id: 0, code: "", type: "", status: "", area: "" });

  // 1. LISTAR (GET)
  const fetchItems = async () => {
    try {
        const res = await api.get("/laboratories/items");
        setItems(res.data.data || []);
        setSource(res.data.source || "Desconocido");
    } catch (err) {
        console.error(err);
        setSource("ERROR DE CONEXIÓN");
    }
  };

  useEffect(() => {
    fetchItems();
    const interval = setInterval(fetchItems, 5000); 
    return () => clearInterval(interval);
  }, []);

  // 2. AGREGAR (POST)
  const handleSave = async () => {
      try {
          const res = await api.post("/laboratories/items", newItem);
          
          if (res.data.source === "MySQL") {
              setSaveStatus({ type: "success", msg: "✅ Guardado correctamente en MySQL (BD Principal)" });
          } else {
              setSaveStatus({ type: "warning", msg: "⚠️ BD SATURADA. Guardado temporalmente en Redis (Respaldo)" });
          }
          fetchItems(); 
          setTimeout(() => {
             setOpen(false); 
             setSaveStatus(null);
             setNewItem({ code: "", type: "PC", status: "Operativa", area: "Sala 1" });
          }, 2000);

      } catch (e) {
          setSaveStatus({ type: "error", msg: "Error crítico del sistema" });
      }
  };

  // --- NUEVO: 3. ELIMINAR (DELETE) ---
  const handleDelete = async (id) => {
      if(!window.confirm("¿Seguro que deseas eliminar este equipo?")) return;

      try {
          await api.delete(`/laboratories/items/${id}`);
          fetchItems(); // Recargar la lista
      } catch (e) {
          alert("Error al eliminar: Posiblemente MySQL no responde.");
      }
  };

  // --- NUEVO: 4. EDITAR (PUT) ---
  const handleEditOpen = (item) => {
      // Cargamos los datos del item en el formulario de edición
      // Mapeamos 'name' a 'code' si viene del backend así, o usamos 'code' directo
      setEditItem({ 
          id: item.id,
          code: item.name || item.code, // Ajuste por si el backend manda 'name'
          type: item.type,
          status: item.status,
          area: item.area
      });
      setOpenEdit(true);
  };

  const handleUpdate = async () => {
      try {
          // Enviamos los datos actualizados
          await api.put(`/laboratories/items/${editItem.id}`, {
             code: editItem.code,
             type: editItem.type,
             status: editItem.status,
             area: editItem.area
          });
          setOpenEdit(false);
          fetchItems();
          alert("Actualizado correctamente en MySQL");
      } catch (e) {
          alert("Error al actualizar: Verifica la conexión a MySQL.");
      }
  };

  const filteredData = items.filter(row => 
      (row.name || row.code || "").toLowerCase().includes(search.toLowerCase())
  );

  // Determinamos si es solo lectura (Si NO es MySQL, bloqueamos botones)
  const isReadOnly = !source.includes("MySQL");

  return (
    <Container maxWidth="xl" sx={{ mt: 4 }}>
      
      {/* HEADER CON INDICADOR DE FUENTE DE DATOS */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
            <Typography variant="h5" fontWeight="bold">Inventario Global</Typography>
            <Box display="flex" alignItems="center" gap={1} mt={1}>
                <Typography variant="body2">Fuente de Datos Actual:</Typography>
                {source.includes("MySQL") ? (
                    <Chip icon={<StorageIcon />} label="MySQL (Principal)" color="success" />
                ) : (
                    <Chip icon={<StorageIcon />} label={source} color="warning" variant="outlined" sx={{ fontWeight: 'bold', border: '2px solid orange' }} />
                )}
            </Box>
        </Box>
        <Button variant="contained" color="primary" startIcon={<AddCircleIcon />} onClick={() => setOpen(true)}>
            Agregar Máquina
        </Button>
      </Box>
      
      {source.includes("REDIS") && (
          <Alert severity="warning" sx={{ mb: 2 }}>
              <AlertTitle>Modo de Emergencia Activado</AlertTitle>
              La base de datos principal no responde. <strong>Visualizando datos cacheados en Redis. (Edición Deshabilitada)</strong>
          </Alert>
      )}

      {/* TABLA */}
      <Paper elevation={2} sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <Box p={2}>
            <TextField 
                size="small" 
                placeholder="Buscar código..." 
                value={search} 
                onChange={e => setSearch(e.target.value)} 
            />
        </Box>
        <Table>
            <TableHead sx={{ bgcolor: '#f5f5f5' }}>
                <TableRow>
                    <TableCell fontWeight="bold">CÓDIGO</TableCell>
                    <TableCell>TIPO</TableCell>
                    <TableCell>ESTADO</TableCell>
                    <TableCell>ÁREA</TableCell>
                    <TableCell align="center">ACCIONES</TableCell> {/* COLUMNA NUEVA */}
                </TableRow>
            </TableHead>
            <TableBody>
                {filteredData.map((row, idx) => (
                    <TableRow key={idx} hover>
                        <TableCell sx={{ fontWeight: 'bold', color: '#1565c0' }}>{row.name || row.code}</TableCell>
                        <TableCell>{row.type}</TableCell>
                        <TableCell>{row.status}</TableCell>
                        <TableCell>{row.area}</TableCell>
                        <TableCell align="center">
                            {/* BOTONES DE ACCIÓN (Deshabilitados si es Redis) */}
                            <IconButton 
                                color="primary" 
                                onClick={() => handleEditOpen(row)}
                                disabled={isReadOnly}
                            >
                                <EditIcon />
                            </IconButton>
                            <IconButton 
                                color="error" 
                                onClick={() => handleDelete(row.id)}
                                disabled={isReadOnly}
                            >
                                <DeleteIcon />
                            </IconButton>
                        </TableCell>
                    </TableRow>
                ))}
                {filteredData.length === 0 && (
                    <TableRow>
                        <TableCell colSpan={5} align="center">No hay datos registrados</TableCell>
                    </TableRow>
                )}
            </TableBody>
        </Table>
      </Paper>

      {/* MODAL DE AGREGAR (TU CÓDIGO ORIGINAL) */}
      <Dialog open={open} onClose={() => setOpen(false)}>
          <DialogTitle>Agregar Nueva Máquina</DialogTitle>
          <DialogContent sx={{ minWidth: 400 }}>
              {saveStatus && (
                  <Alert severity={saveStatus.type} sx={{ mb: 2 }}>
                      {saveStatus.msg}
                  </Alert>
              )}
              
              <TextField fullWidth margin="dense" label="Código (Ej: PC-100)" 
                  value={newItem.code} onChange={e => setNewItem({...newItem, code: e.target.value})} 
              />
              <TextField fullWidth margin="dense" label="Tipo" 
                  value={newItem.type} onChange={e => setNewItem({...newItem, type: e.target.value})} 
              />
              <TextField fullWidth margin="dense" label="Estado" 
                  value={newItem.status} onChange={e => setNewItem({...newItem, status: e.target.value})} 
              />
              <TextField fullWidth margin="dense" label="Área" 
                  value={newItem.area} onChange={e => setNewItem({...newItem, area: e.target.value})} 
              />
          </DialogContent>
          <DialogActions>
              <Button onClick={() => setOpen(false)}>Cancelar</Button>
              <Button variant="contained" onClick={handleSave} disabled={!newItem.code}>Guardar</Button>
          </DialogActions>
      </Dialog>

      {/* --- NUEVO: MODAL DE EDITAR --- */}
      <Dialog open={openEdit} onClose={() => setOpenEdit(false)}>
          <DialogTitle>Editar Máquina (MySQL)</DialogTitle>
          <DialogContent sx={{ minWidth: 400 }}>
              <TextField fullWidth margin="dense" label="Código" 
                  value={editItem.code} onChange={e => setEditItem({...editItem, code: e.target.value})} 
              />
              <TextField fullWidth margin="dense" label="Tipo" 
                  value={editItem.type} onChange={e => setEditItem({...editItem, type: e.target.value})} 
              />
              <TextField fullWidth margin="dense" label="Estado" 
                  value={editItem.status} onChange={e => setEditItem({...editItem, status: e.target.value})} 
              />
              <TextField fullWidth margin="dense" label="Área" 
                  value={editItem.area} onChange={e => setEditItem({...editItem, area: e.target.value})} 
              />
          </DialogContent>
          <DialogActions>
              <Button onClick={() => setOpenEdit(false)}>Cancelar</Button>
              <Button variant="contained" color="secondary" onClick={handleUpdate}>Actualizar</Button>
          </DialogActions>
      </Dialog>

    </Container>
  );
}

export default ReportPage;