import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { 
  Container, Typography, Box, Button, Chip, 
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, 
  MenuItem, Paper, Divider, Grid, IconButton 
} from "@mui/material";

// Iconos
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import BuildIcon from '@mui/icons-material/Build';
import VisibilityIcon from '@mui/icons-material/Visibility';
import api from "../api/axios";
import AssessmentIcon from '@mui/icons-material/Assessment';
import DeleteIcon from '@mui/icons-material/Delete'; // <--- IMPORTANTE

function LabDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [lab, setLab] = useState(null);
  const [loading, setLoading] = useState(true);

  // Estados de Modales
  const [openAdd, setOpenAdd] = useState(false);
  const [openHistory, setOpenHistory] = useState(false);
  const [openMaint, setOpenMaint] = useState(false);
  const [openUpdate, setOpenUpdate] = useState(false);
  
  const [selectedItem, setSelectedItem] = useState(null);

  // Formularios
  const [formData, setFormData] = useState({ code: "", type: "Computadora", status: "Operativa", area: "", date: "" });
  const [maintData, setMaintData] = useState({ technician: "", type: "Preventivo", description: "" });

  // 1. Cargar Datos
  const fetchLab = async () => {
    try {
        const res = await api.get(`/laboratories/${id}`);
        setLab(res.data);
    } catch (e) { 
        console.error(e);
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => { fetchLab(); }, [id]);

  // 2. Handlers (Guardar datos)
  const handleSaveItem = async () => {
    try {
        await api.put(`/laboratories/${id}/add-item`, {
            code: formData.code,
            type: formData.type,
            status: formData.status,
            area: formData.area,
            acquisition_date: formData.date || "2026-01-01" 
        });
        
        setOpenAdd(false);
        setFormData({ code: "", type: "Computadora", status: "Operativa", area: "", date: "" });
        fetchLab();
        alert("¡Máquina guardada correctamente!"); 
    } catch (e) { 
        console.error(e);
        alert("Error al guardar: " + (e.response?.data?.detail || "Error desconocido")); 
    }
  };

  const handleSaveMaintenance = async () => {
      try {
          await api.post(`/laboratories/${id}/items/${selectedItem.id}/maintenance`, {
              technician: maintData.technician,
              type: maintData.type,
              description: maintData.description
          });
          
          setOpenMaint(false);
          setMaintData({ technician: "", type: "Preventivo", description: "" });
          fetchLab();
          alert("Mantenimiento registrado con éxito");
      } catch (e) { 
          console.error(e);
          alert("Error al registrar: Verifica que todos los campos estén llenos."); 
      }
  };

  const handleUpdateItem = async () => {
      try {
        await api.put(`/laboratories/${id}/items/${selectedItem.id}`, {
            code: formData.code,
            type: formData.type,
            status: formData.status,
            area: formData.area || "General", 
            acquisition_date: formData.date || "2024-01-01"
        });
        
        setOpenUpdate(false);
        fetchLab(); 
        alert("Máquina actualizada correctamente");
      } catch (e) { 
        console.error(e);
        alert("Error al actualizar: Verifica los datos."); 
      }
  };

  // --- NUEVO: FUNCIÓN ELIMINAR MÁQUINA ---
  const handleDeleteItem = async (itemId, name) => {
      if(window.confirm(`¿Estás seguro de ELIMINAR la máquina "${name}"? Esta acción no se puede deshacer.`)) {
          try {
              await api.delete(`/laboratories/${id}/items/${itemId}`);
              fetchLab(); // Recargar la lista
          } catch (e) {
              console.error(e);
              alert("Error al eliminar la máquina");
          }
      }
  };

  // Abrir modales
  const openModal = (type, item) => {
      setSelectedItem(item);
      if (type === 'history') setOpenHistory(true);
      if (type === 'maint') setOpenMaint(true);
      if (type === 'update') {
          setFormData({ ...formData, code: item.name, status: item.status }); 
          setOpenUpdate(true);
      }
  };

  if (loading) return <Typography sx={{ mt: 5, textAlign: 'center' }}>Cargando...</Typography>;
  if (!lab) return <Typography sx={{ mt: 5, textAlign: 'center', color: 'red', fontWeight: 'bold' }}>Error: No se pudo cargar el laboratorio.</Typography>;

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      
      {/* HEADER AZUL CLARO */}
      <Paper elevation={0} sx={{ p: 2, bgcolor: '#e3f2fd', display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, border: '1px solid #90caf9' }}>
        <Box display="flex" alignItems="center" gap={2}>
            <Box sx={{ bgcolor: '#2196f3', p: 1.5, borderRadius: 2, color: 'white' }}>
                <BuildIcon fontSize="medium" />
            </Box>
            <Box>
                <Typography variant="h6" fontWeight="bold" color="#1565c0">{lab.name}</Typography>
                <Typography variant="body2" color="text.secondary">Ubicación: {lab.location} | FICA</Typography>
            </Box>
        </Box>
        <Typography variant="h4" fontWeight="bold" color="#1565c0">{lab.items?.length || 0}</Typography>
      </Paper>

      {/* BOTONERA SUPERIOR */}
      <Box sx={{ mb: 3, display: 'flex', gap: 1 }}>
        <Button variant="contained" sx={{ bgcolor: '#29b6f6' }} onClick={() => setOpenAdd(true)}>Agregar Máquina</Button>
        <Button variant="outlined" startIcon={<AssessmentIcon />} onClick={() => navigate("/reportes")}>Ir a Inventario Global (MySQL)</Button>
        <Button variant="contained" sx={{ bgcolor: '#29b6f6' }} onClick={() => navigate("/dashboard")}>Regresar</Button>
      </Box>

      {/* --- LISTA DE MAQUINAS --- */}
      <Box display="flex" flexDirection="column" gap={2}>
        {lab.items?.map((item) => (
            <Paper key={item.id} elevation={1} sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderLeft: item.status === 'Operativa' ? '5px solid #4caf50' : '5px solid #f44336' }}>
                
                {/* Info Izquierda */}
                <Box display="flex" alignItems="center" gap={3} flex={1}>
                    <Box sx={{ width: 50, height: 50, bgcolor: '#0277bd', borderRadius: 1 }}></Box> 
                    <Box>
                        <Typography variant="h6" fontWeight="bold">{item.name || item.code}</Typography> 
                        <Typography variant="body2" color="text.secondary">{item.area} | {item.type}</Typography>
                    </Box>
                </Box>

                {/* Estado */}
                <Box sx={{ minWidth: 150, textAlign: 'center' }}>
                    <Chip 
                        label={item.status ? item.status.toUpperCase() : "DESCONOCIDO"} 
                        sx={{ 
                            bgcolor: item.status === 'Operativa' ? '#4caf50' : '#f44336', 
                            color: 'white', 
                            fontWeight: 'bold',
                            width: '100%'
                        }} 
                    />
                </Box>

                {/* Botones de Acción */}
                <Box display="flex" alignItems="center" gap={1} ml={4}>
                    <Button 
                        variant="contained" size="small" 
                        sx={{ bgcolor: '#fdd835', color: 'black', fontWeight: 'bold', '&:hover': { bgcolor: '#fbc02d' } }}
                        onClick={() => openModal('history', item)}
                    >
                        Historial
                    </Button>
                    <Button 
                        variant="contained" size="small" 
                        sx={{ bgcolor: '#1976d2', fontWeight: 'bold' }}
                        onClick={() => openModal('maint', item)}
                    >
                        Mantenimiento
                    </Button>
                    <Button 
                        variant="contained" size="small" 
                        sx={{ bgcolor: '#00e676', fontWeight: 'bold', color: 'black' }}
                        onClick={() => openModal('update', item)}
                    >
                        Actualizar
                    </Button>
                    
                    {/* --- NUEVO: BOTÓN ELIMINAR --- */}
                    <IconButton 
                        color="error" 
                        sx={{ bgcolor: '#ffebee', '&:hover': { bgcolor: '#ffcdd2' } }}
                        onClick={() => handleDeleteItem(item.id, item.name || item.code)}
                    >
                        <DeleteIcon />
                    </IconButton>
                </Box>
            </Paper>
        ))}
        {(!lab.items || lab.items.length === 0) && (
            <Typography variant="body1" textAlign="center" color="text.secondary" sx={{mt:4}}>
                No hay máquinas registradas en este laboratorio.
            </Typography>
        )}
      </Box>

      {/* --- MODAL AGREGAR --- */}
      <Dialog open={openAdd} onClose={() => setOpenAdd(false)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight="bold">Agregar Máquina</DialogTitle>
        <DialogContent>
            <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField select label="Tipo de Equipo" fullWidth value={formData.type} onChange={(e) => setFormData({...formData, type: e.target.value})}>
                    <MenuItem value="Computadora">Computadora</MenuItem>
                    <MenuItem value="Impresora">Impresora</MenuItem>
                </TextField>
                <TextField label="Código del equipo" fullWidth value={formData.code} onChange={(e) => setFormData({...formData, code: e.target.value})} placeholder="Ingresa código"/>
                <TextField select label="Estado actual" fullWidth value={formData.status} onChange={(e) => setFormData({...formData, status: e.target.value})}>
                    <MenuItem value="Operativa">Operativa</MenuItem>
                    <MenuItem value="Fuera de Servicio">Fuera de Servicio</MenuItem>
                </TextField>
                <TextField label="Área" fullWidth value={formData.area} onChange={(e) => setFormData({...formData, area: e.target.value})} placeholder="Ingresa el área"/>
                <TextField type="date" label="Fecha de adquisición" InputLabelProps={{ shrink: true }} fullWidth />
            </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
            <Button onClick={handleSaveItem} variant="contained" fullWidth sx={{ bgcolor: '#29b6f6' }}>Guardar</Button>
            <Button onClick={() => setOpenAdd(false)} variant="contained" fullWidth color="error">Cancelar</Button>
        </DialogActions>
      </Dialog>

       {/* --- MODAL ACTUALIZAR --- */}
       <Dialog open={openUpdate} onClose={() => setOpenUpdate(false)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight="bold">Actualizar Máquina</DialogTitle>
        <DialogContent>
            <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField select label="Tipo de Equipo" fullWidth value={formData.type} onChange={(e) => setFormData({...formData, type: e.target.value})}>
                    <MenuItem value="Computadora">Computadora</MenuItem>
                    <MenuItem value="Impresora">Impresora</MenuItem>
                </TextField>
                <TextField label="Código del equipo" fullWidth value={formData.code} onChange={(e) => setFormData({...formData, code: e.target.value})} />
                <TextField select label="Estado actual" fullWidth value={formData.status} onChange={(e) => setFormData({...formData, status: e.target.value})}>
                    <MenuItem value="Operativa">Operativa</MenuItem>
                    <MenuItem value="Fuera de Servicio">Fuera de Servicio</MenuItem>
                </TextField>
            </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
            <Button onClick={handleUpdateItem} variant="contained" fullWidth sx={{ bgcolor: '#29b6f6' }}>Actualizar</Button>
            <Button onClick={() => setOpenUpdate(false)} variant="contained" fullWidth color="error">Cancelar</Button>
        </DialogActions>
      </Dialog>

      {/* --- MODAL MANTENIMIENTO --- */}
      <Dialog open={openMaint} onClose={() => setOpenMaint(false)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight="bold">Registro de mantenimiento</DialogTitle>
        <DialogContent>
            <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box display="flex" gap={1}>
                    <TextField label="Técnico Responsable" fullWidth value={maintData.technician} onChange={(e) => setMaintData({...maintData, technician: e.target.value})} />
                    <TextField select label="Tipo" fullWidth value={maintData.type} onChange={(e) => setMaintData({...maintData, type: e.target.value})}>
                        <MenuItem value="Preventivo">Preventivo</MenuItem>
                        <MenuItem value="Correctivo">Correctivo</MenuItem>
                    </TextField>
                </Box>
                <TextField type="date" label="Fecha" InputLabelProps={{ shrink: true }} fullWidth />
                <TextField label="Observaciones" multiline rows={3} fullWidth value={maintData.description} onChange={(e) => setMaintData({...maintData, description: e.target.value})} />
            </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
            <Button onClick={handleSaveMaintenance} variant="contained" fullWidth sx={{ bgcolor: '#29b6f6' }}>Guardar</Button>
            <Button onClick={() => setOpenMaint(false)} variant="contained" fullWidth color="error">Cancelar</Button>
        </DialogActions>
      </Dialog>

      {/* --- MODAL HISTORIAL --- */}
      <Dialog open={openHistory} onClose={() => setOpenHistory(false)} maxWidth="sm" fullWidth>
        <DialogTitle fontWeight="bold">Historial de Mantenimiento</DialogTitle>
        <Typography variant="body2" sx={{ px: 3, mb: 2 }}>Equipo: {selectedItem?.name}</Typography>
        <DialogContent dividers>
            <Grid container spacing={1} sx={{ mb: 1, fontWeight: 'bold', borderBottom: '2px solid #29b6f6', pb: 1 }}>
                <Grid item xs={3}>Fecha</Grid>
                <Grid item xs={2}>Tipo</Grid>
                <Grid item xs={3}>Técnico</Grid>
                <Grid item xs={4}>Observaciones</Grid>
            </Grid>
            {(!selectedItem?.maintenance_history || selectedItem.maintenance_history.length === 0) ? (
                <Typography align="center" sx={{ mt: 2, color: 'text.secondary' }}>No hay mantenimientos registrados.</Typography>
            ) : (
                selectedItem.maintenance_history.map((log, idx) => (
                    <Grid container spacing={1} key={idx} sx={{ py: 1, borderBottom: '1px solid #eee' }}>
                        <Grid item xs={3}>{log.date || "2026-02-15"}</Grid>
                        <Grid item xs={2}>{log.type}</Grid>
                        <Grid item xs={3}>{log.technician}</Grid>
                        <Grid item xs={4}>{log.description}</Grid>
                    </Grid>
                ))
            )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
            <Button onClick={() => setOpenHistory(false)} variant="contained" color="secondary">Regresar</Button>
        </DialogActions>
      </Dialog>

    </Container>
  );
}

export default LabDetailPage;