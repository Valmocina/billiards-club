import React, { useState } from 'react';
import { Clock, Calendar, X, Trash2, Edit2, Plus, ArrowLeft, Info, AlertCircle, Infinity, User } from 'lucide-react';

const App = () => {
  // Initial state for tables
  const [tables, setTables] = useState([
    { id: 1, name: 'Table 1', status: 'Available', occupiedUntil: null },
    { id: 2, name: 'Table 2', status: 'Available', occupiedUntil: null },
    { id: 3, name: 'Table 3', status: 'Available', occupiedUntil: null },
    { id: 4, name: 'Table 4', status: 'Available', occupiedUntil: null },
    { id: 5, name: 'Table 5', status: 'Available', occupiedUntil: null },
    { id: 6, name: 'Table 6', status: 'Available', occupiedUntil: null },
  ]);

  const [reservations, setReservations] = useState([]);
  const [currentView, setCurrentView] = useState('dashboard'); // 'dashboard' or 'management'
  
  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [selectedTable, setSelectedTable] = useState(null);
  const [modalType, setModalType] = useState(null); // 'reserve', 'walkin', 'edit'
  
  // Form Data State
  const [formData, setFormData] = useState({
    guestName: '',
    date: '',
    time: '',
    duration: 1, // Default 1 hour for walk-in
    isOpenTime: false, // New state for Open Time
  });

  const [error, setError] = useState('');

  // Management State
  const [newTableName, setNewTableName] = useState('');

  // --- NAVIGATION ---
  const toggleView = () => {
    setCurrentView(currentView === 'dashboard' ? 'management' : 'dashboard');
    resetForm();
    setNewTableName('');
  };

  const resetForm = () => {
    setFormData({
      guestName: '',
      date: new Date().toISOString().split('T')[0], // Default today
      time: '',
      duration: 1,
      isOpenTime: false
    });
    setError('');
  };

  // --- ACTIONS (Dashboard) ---
  const handleWalkInClick = (table) => {
    setSelectedTable(table);
    setModalType('walkin');
    resetForm();
    setShowModal(true);
  };

  const handleReserveClick = (table) => {
    setSelectedTable(table);
    setModalType('reserve');
    resetForm();
    setShowModal(true);
  };

  const resetTable = (id) => {
    setTables(tables.map(t => 
      t.id === id ? { ...t, status: 'Available', occupiedUntil: null } : t
    ));
  };

  const handleCancelReservation = (id) => {
    setReservations(reservations.filter(r => r.id !== id));
  };

  // --- ACTIONS (Management) ---
  const handleAddTable = () => {
    if (!newTableName.trim()) return;
    const newId = tables.length > 0 ? Math.max(...tables.map(t => t.id)) + 1 : 1;
    setTables([...tables, { id: newId, name: newTableName, status: 'Available', occupiedUntil: null }]);
    setNewTableName('');
  };

  const handleDeleteTable = (id) => {
    const tableToDelete = tables.find(t => t.id === id);
    const hasActiveReservation = reservations.some(r => r.tableName === tableToDelete.name);
    
    if (hasActiveReservation || tableToDelete.status === 'Occupied') {
      alert("Cannot delete table with active status or upcoming reservations.");
      return;
    }
    setTables(tables.filter(t => t.id !== id));
  };

  const openEditModal = (table) => {
    setSelectedTable(table);
    setModalType('edit');
    setFormData({ ...formData, guestName: table.name }); // reusing guestName for table name editing
    setShowModal(true);
  };

  // --- LOGIC: TIME & CONFLICTS ---

  // Helper to find the next reservation TODAY for a specific table
  const getNextTodayReservation = (table) => {
    if (!table) return null;
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    
    const todaysReservations = reservations
      .filter(r => r.tableName === table.name && r.rawDate === todayStr)
      .map(res => {
        const [h, m] = res.rawTime.split(':').map(Number);
        const start = new Date(now);
        start.setHours(h, m, 0, 0);
        return { ...res, startObj: start };
      })
      .filter(res => res.startObj > now) // Only future reservations
      .sort((a, b) => a.startObj - b.startObj); // Sort by soonest

    return todaysReservations.length > 0 ? todaysReservations[0] : null;
  };

  // Helper to format duration in H and M
  const formatDuration = (diffMs) => {
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0 && minutes > 0) return `${hours}H and ${minutes}M`;
    if (hours > 0) return `${hours}H`;
    return `${minutes}M`;
  };

  const checkWalkInConflict = (table, durationHours, isOpenTime) => {
    const now = new Date();
    const nextRes = getNextTodayReservation(table);

    // 1. Check Logic for OPEN TIME
    if (isOpenTime) {
      if (nextRes) {
        // Calculate hours until reservation
        const diffMs = nextRes.startObj - now;
        const diffHours = diffMs / (1000 * 60 * 60);

        if (diffHours < 1) {
           return `Cannot select Open Time. Less than 1 hour (${formatDuration(diffMs)}) available before reservation at ${convertTo12Hour(nextRes.rawTime)}.`;
        }
        // It is allowed, but we will cap the time in handleConfirm
        return null; 
      }
      return null;
    }

    // 2. Check Logic for STANDARD DURATION
    const walkInEnd = new Date(now.getTime() + durationHours * 60 * 60 * 1000);
    
    // Filter reservations for this table that are happening TODAY
    const todayStr = now.toISOString().split('T')[0];
    const todaysReservations = reservations.filter(
      r => r.tableName === table.name && r.rawDate === todayStr
    );
    
    for (const res of todaysReservations) {
      const [resHours, resMinutes] = res.rawTime.split(':').map(Number);
      const resStart = new Date(now);
      resStart.setHours(resHours, resMinutes, 0, 0);

      if (walkInEnd > resStart && resStart > now) {
         const diffMs = resStart - now;
         return `Conflict! Only ${formatDuration(diffMs)} available before reservation at ${convertTo12Hour(res.rawTime)}`;
      }
    }
    return null;
  };

  const convertTo12Hour = (time24) => {
    if (!time24) return '';
    const [hours, minutes] = time24.split(':');
    let h = parseInt(hours, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    h = h ? h : 12; // the hour '0' should be '12'
    return `${h}:${minutes} ${ampm}`;
  };

  // --- SHARED MODAL LOGIC ---
  const handleConfirm = () => {
    setError('');

    if (modalType === 'edit') {
      if (!formData.guestName.trim()) return;
      setTables(tables.map(t => 
        t.id === selectedTable.id ? { ...t, name: formData.guestName } : t
      ));
      closeModal();
      return;
    }

    if (modalType === 'reserve' && !formData.guestName.trim()) {
      setError('Please enter a name for the reservation');
      return;
    }

    if (modalType === 'walkin') {
      const conflictMsg = checkWalkInConflict(selectedTable, Number(formData.duration), formData.isOpenTime);
      if (conflictMsg) {
        setError(conflictMsg);
        return;
      }

      // No conflict, proceed
      let occupiedUntilStr = '';
      
      if (formData.isOpenTime) {
        // If Open Time, check if we need to cap it at the next reservation
        const nextRes = getNextTodayReservation(selectedTable);
        if (nextRes) {
           occupiedUntilStr = convertTo12Hour(nextRes.rawTime); // Stop at reservation time
        } else {
           occupiedUntilStr = 'Open Time';
        }
      } else {
        const endTime = new Date(Date.now() + Number(formData.duration) * 60 * 60 * 1000);
        occupiedUntilStr = endTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
      }

      setTables(tables.map(t => 
        t.id === selectedTable.id ? { 
          ...t, 
          status: 'Occupied', 
          occupiedUntil: occupiedUntilStr
        } : t
      ));
      closeModal();
    } 
    else if (modalType === 'reserve') {
      if (!formData.date || !formData.time) {
        setError('Please select both date and time');
        return;
      }

      const [h, m] = formData.time.split(':').map(Number);
      if (h < 7) {
        setError('Reservations are only allowed between 7:00 AM and 11:59 PM.');
        return;
      }

      const newReservation = {
        id: Date.now(),
        tableName: selectedTable.name,
        guestName: formData.guestName,
        rawDate: formData.date,
        rawTime: formData.time,
        displayDate: new Date(formData.date).toLocaleDateString(),
        displayTime: convertTo12Hour(formData.time)
      };
      
      setReservations([...reservations, newReservation].sort((a,b) => {
         return new Date(`${a.rawDate}T${a.rawTime}`) - new Date(`${b.rawDate}T${b.rawTime}`);
      }));
      closeModal();
    }
  };

  const handleOpenTimeToggle = () => {
    // Check constraints before toggling ON
    if (!formData.isOpenTime) {
      const nextRes = getNextTodayReservation(selectedTable);
      if (nextRes) {
        const now = new Date();
        const diffMs = nextRes.startObj - now;
        const diffHours = diffMs / (1000 * 60 * 60);
        
        if (diffHours < 1) {
          setError(`Cannot select Open Time. Only ${formatDuration(diffMs)} available until reservation at ${convertTo12Hour(nextRes.rawTime)}.`);
          return;
        }
      }
    }
    
    setError(''); // Clear errors if toggling or if valid
    setFormData({...formData, isOpenTime: !formData.isOpenTime});
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedTable(null);
    setModalType(null);
    setError('');
  };

  // -- Render Helper for Modal Warning --
  const renderOpenTimeWarning = () => {
     if (modalType !== 'walkin' || !formData.isOpenTime) return null;
     
     const nextRes = getNextTodayReservation(selectedTable);
     if (nextRes) {
       const now = new Date();
       const diffMs = nextRes.startObj - now;
       
       return (
         <div className="bg-[#F8D49B]/20 border border-[#F8D49B] rounded-xl p-3 flex items-start gap-2 mt-3 animate-in fade-in zoom-in-95">
           <AlertCircle className="w-5 h-5 text-[#F8BC9B] flex-shrink-0 mt-0.5" />
           <div className="text-sm text-slate-600">
             <p className="font-semibold">Note: Upcoming Reservation</p>
             <p>Table reserved at <span className="font-bold">{convertTo12Hour(nextRes.rawTime)}</span>.</p>
             <p>Playtime available: <span className="font-bold">{formatDuration(diffMs)}</span>.</p>
           </div>
         </div>
       );
     }
     return null;
  };

  return (
    <div className="min-h-screen font-sans text-slate-700 p-4 md:p-8 relative overflow-hidden bg-[#fdfbf7]">
      
      {/* Soft Gradient Background */}
      <div className="fixed inset-0 bg-gradient-to-br from-[#75BDE0]/5 via-[#F8D49B]/5 to-[#F89B9B]/5 -z-10 pointer-events-none"></div>

      {/* Header */}
      <header className="text-center mb-12 animate-in fade-in slide-in-from-top-4 duration-700">
        <h1 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-[#75BDE0] to-[#F89B9B] mb-3 drop-shadow-sm">
          8-Ball Billiards Club
        </h1>
        <p className="text-slate-400 text-xl font-medium">Reserve your table for the perfect game</p>
        
        <div className="mt-8 flex justify-center">
          <button 
            onClick={toggleView}
            className="group relative bg-white pl-5 pr-6 py-3 rounded-full shadow-md hover:shadow-xl border border-[#F8D49B] hover:border-[#F89B9B] transition-all flex items-center gap-3 font-semibold text-slate-600 hover:text-[#75BDE0] overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-[#75BDE0]/10 to-[#F89B9B]/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <span className="relative flex items-center gap-2 z-10">
            {currentView === 'dashboard' ? (
              <>Table Management</>
            ) : (
              <><ArrowLeft className="w-5 h-5 transition-transform group-hover:-translate-x-1" /> Back to Reservations</>
            )}
            </span>
          </button>
        </div>
      </header>

      {/* --- DASHBOARD VIEW --- */}
      {currentView === 'dashboard' && (
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          
          {/* Left Column: Available Tables */}
          <div className="lg:col-span-2 space-y-8">
            <h2 className="text-2xl font-bold text-slate-700 pl-2 flex items-center gap-2">
              <div className="w-2 h-8 bg-[#75BDE0] rounded-full"></div>
              Available Tables
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {tables.map((table) => (
                <div 
                  key={table.id} 
                  className={`relative p-6 rounded-3xl shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden group ${
                    table.status === 'Available' 
                      ? 'bg-white border border-[#75BDE0]/30' 
                      : 'bg-slate-50 border border-slate-200 opacity-90'
                  }`}
                >
                  {/* Background Pattern */}
                  <div className="absolute right-0 top-0 -mt-4 -mr-4 text-[#75BDE0]/10 opacity-20 group-hover:opacity-30 transition-opacity duration-500 pointer-events-none">
                    <svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-club"><path d="M17.28 9.05a5.5 5.5 0 1 0-10.56 0A5.5 5.5 0 1 0 12 17.66a5.5 5.5 0 1 0 5.28-8.6Z"/></svg>
                  </div>

                  <div className="flex justify-between items-start mb-6 relative z-10">
                    <span className="font-bold text-xl text-slate-700">{table.name}</span>
                    <div className="text-right">
                      <span className={`px-4 py-1.5 rounded-full text-sm font-bold shadow-sm ${
                        table.status === 'Available' 
                          ? 'bg-[#75BDE0] text-white' 
                          : 'bg-[#F89B9B] text-white'
                      }`}>
                        {table.status}
                      </span>
                      {table.status === 'Occupied' && table.occupiedUntil && (
                        <p className="text-sm font-medium text-[#F89B9B] mt-2 flex items-center justify-end gap-1.5">
                          {table.occupiedUntil === 'Open Time' ? (
                            <><Infinity className="w-4 h-4 text-[#F89B9B]" /> <span className="text-[#F89B9B]">Open Time</span></>
                          ) : (
                            <><Clock className="w-4 h-4" /> Until {table.occupiedUntil}</>
                          )}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-4 relative z-10">
                    {table.status === 'Available' ? (
                      <>
                        <button
                          onClick={() => handleReserveClick(table)}
                          className="flex-1 bg-[#75BDE0] hover:bg-[#64a9cc] text-white py-3 rounded-2xl text-sm font-bold transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
                        >
                          Reserve
                        </button>
                        <button
                          onClick={() => handleWalkInClick(table)}
                          className="flex-1 bg-[#F8BC9B] hover:bg-[#e6ab8c] text-white py-3 rounded-2xl text-sm font-bold transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
                        >
                          Walk-In
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => resetTable(table.id)}
                        className="w-full bg-white hover:bg-slate-50 text-slate-500 font-bold py-3 rounded-2xl text-sm transition-all shadow-sm border border-slate-200 hover:border-slate-300 hover:shadow-md"
                      >
                        Reset to Available
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: Upcoming Reservations */}
          <div className="lg:col-span-1 space-y-8">
            <h2 className="text-2xl font-bold text-slate-700 pl-2 flex items-center gap-2">
              <div className="w-2 h-8 bg-[#F89B9B] rounded-full"></div>
              Upcoming Reservations
            </h2>
            
            <div className="bg-white/80 backdrop-blur-sm p-6 rounded-3xl shadow-sm border border-[#F8D49B]/30 min-h-[400px] relative overflow-hidden">
              {/* Background Illustration */}
              <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none">
                <Calendar className="w-48 h-48 text-[#75BDE0]" />
              </div>

              {reservations.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center relative z-10 p-8">
                  <div className="w-20 h-20 bg-[#F8D49B]/20 rounded-full flex items-center justify-center mb-4">
                    <Calendar className="w-10 h-10 text-[#F8BC9B]" />
                  </div>
                  <p className="text-slate-600 text-lg font-medium">No upcoming reservations</p>
                  <p className="text-slate-400 text-sm">Your schedule is clear for now.</p>
                </div>
              ) : (
                <div className="space-y-4 relative z-10">
                  {reservations.map((res) => (
                    <div key={res.id} className="group relative p-5 bg-white rounded-2xl border border-[#F8D49B]/30 shadow-sm hover:shadow-md transition-all animate-in fade-in slide-in-from-bottom-2">
                       {/* Trash Can Button (Shows on Hover) */}
                      <button 
                        onClick={() => handleCancelReservation(res.id)}
                        className="absolute top-3 right-3 p-2 text-slate-300 hover:text-[#F89B9B] bg-transparent hover:bg-[#F89B9B]/10 rounded-xl transition-all opacity-0 group-hover:opacity-100 hover:shadow-sm"
                        title="Cancel Reservation"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>

                      <div className="flex justify-between items-start">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 bg-[#75BDE0]/20 rounded-full flex items-center justify-center">
                            <User className="w-5 h-5 text-[#75BDE0]" />
                          </div>
                          <div>
                            <p className="font-bold text-lg text-slate-700">{res.guestName}</p>
                            <p className="text-sm font-medium text-[#F8BC9B]">{res.tableName}</p>
                          </div>
                        </div>
                        <div className="text-right mr-10">
                           <div className="font-bold text-[#75BDE0] mb-1">{res.displayDate}</div>
                           <div className="flex items-center justify-end text-sm font-medium text-slate-600 bg-slate-50 px-3 py-1 rounded-lg">
                            <Clock className="w-4 h-4 mr-1.5 text-[#F89B9B]" />
                            {res.displayTime}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- MANAGEMENT VIEW --- */}
      {currentView === 'management' && (
        <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
           <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-sm border border-[#F8D49B]/30 overflow-hidden">
              <div className="p-8 md:p-10 space-y-10">
                
                {/* Section Header */}
                <div className="border-b border-slate-100 pb-6">
                  <h2 className="text-3xl font-bold text-slate-700 flex items-center gap-3">
                    <div className="w-3 h-10 bg-gradient-to-b from-[#75BDE0] to-[#F8BC9B] rounded-full"></div>
                    Table Management
                  </h2>
                  <p className="text-slate-400 mt-2 pl-6">Add, rename, or remove tables from your club.</p>
                </div>

                {/* Add New Table */}
                <div className="space-y-4 bg-slate-50/50 p-6 rounded-2xl border border-slate-100">
                  <label className="text-lg font-bold text-slate-700 flex items-center gap-2">
                    <Plus className="w-5 h-5 text-[#75BDE0]" /> Add New Table
                  </label>
                  <div className="flex flex-col md:flex-row gap-4">
                    <input 
                      type="text" 
                      value={newTableName}
                      onChange={(e) => setNewTableName(e.target.value)}
                      placeholder="Enter a unique table name..."
                      className="flex-1 bg-white border border-slate-200 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-[#F8D49B] focus:border-[#F8BC9B] outline-none transition-all shadow-sm text-lg text-slate-700"
                    />
                    <button 
                      onClick={handleAddTable}
                      disabled={!newTableName.trim()}
                      className={`px-8 py-4 rounded-2xl font-bold text-white transition-all shadow-md ${
                        newTableName.trim() 
                          ? 'bg-[#75BDE0] hover:bg-[#64a9cc] hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0' 
                          : 'bg-slate-300 cursor-not-allowed shadow-none'
                      }`}
                    >
                      Add Table
                    </button>
                  </div>
                </div>

                {/* Existing Tables List */}
                <div className="space-y-4">
                  <p className="text-xl font-bold text-slate-700 pl-2">Existing Tables</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {tables.map(table => (
                      <div key={table.id} className="group flex items-center justify-between p-5 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-md hover:border-[#F8D49B]/50 transition-all">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
                            <span className="font-bold text-[#F8BC9B]">#{table.id}</span>
                          </div>
                          <span className="font-bold text-lg text-slate-700">{table.name}</span>
                        </div>
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => openEditModal(table)}
                            className="p-2.5 text-[#75BDE0] bg-[#75BDE0]/10 hover:bg-[#75BDE0]/20 rounded-xl transition-colors"
                            title="Edit Name"
                          >
                            <Edit2 className="w-5 h-5" />
                          </button>
                          <button 
                            onClick={() => handleDeleteTable(table.id)}
                            className="p-2.5 text-[#F89B9B] bg-[#F89B9B]/10 hover:bg-[#F89B9B]/20 rounded-xl transition-colors"
                            title="Delete Table"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Info Note */}
                <div className="bg-[#F8D49B]/10 rounded-2xl p-5 border border-[#F8D49B]/30 flex items-start gap-4">
                  <div className="p-2 bg-white rounded-full flex-shrink-0 shadow-sm">
                    <Info className="w-6 h-6 text-[#F8BC9B]" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-700 mb-1">Important Note</p>
                    <p className="text-slate-500 leading-relaxed">
                      Tables with active or upcoming reservations cannot be removed. You must cancel all reservations first. Renaming a table will automatically update all associated reservations.
                    </p>
                  </div>
                </div>

              </div>
           </div>
        </div>
      )}

      {/* Shared Modal (Reserve / Walk-in / Edit) */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300 border border-white/50">
            
            {/* Modal Header with Gradient */}
            <div className={`p-6 pb-8 relative overflow-hidden bg-gradient-to-br from-[#75BDE0] to-[#F89B9B]`}>
              
              {/* Background Decoration */}
              <div className="absolute top-0 right-0 -mt-4 -mr-4 text-white/10 pointer-events-none">
                {modalType === 'reserve' && <Calendar className="w-32 h-32" />}
                {(modalType === 'walkin' || modalType === 'edit') && <Edit2 className="w-32 h-32" />}
              </div>

              <div className="flex justify-between items-center relative z-10">
                <h3 className="text-2xl font-extrabold text-white drop-shadow-sm">
                  {modalType === 'reserve' && 'New Reservation'}
                  {modalType === 'walkin' && 'Walk-In Session'}
                  {modalType === 'edit' && 'Edit Table Name'}
                </h3>
                <button onClick={closeModal} className="p-2 bg-white/20 hover:bg-white/30 rounded-full text-white transition-colors backdrop-blur-sm">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <p className="text-white/80 mt-2 font-medium relative z-10">
                {modalType === 'edit' ? 'Update the name of this table.' : `Enter details for ${selectedTable?.name}.`}
              </p>
            </div>

            <div className="p-8 space-y-6">

              {/* --- Dynamic Inputs based on Type --- */}
              
              {/* 1. Name Input (All types) */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2 pl-1">
                  {modalType === 'edit' ? 'New Table Name' : (modalType === 'walkin' ? 'Guest Name (Optional)' : 'Guest Name')}
                </label>
                <input
                  type="text"
                  autoFocus
                  value={formData.guestName}
                  onChange={(e) => setFormData({...formData, guestName: e.target.value})}
                  placeholder={modalType === 'edit' ? "Enter new name" : "Enter guest name"}
                  className="w-full px-5 py-4 rounded-2xl border-2 border-slate-100 bg-slate-50 focus:bg-white focus:border-[#75BDE0] focus:ring-4 focus:ring-[#75BDE0]/20 outline-none transition-all text-lg font-medium text-slate-700"
                />
              </div>

              {/* 2. Reservation Specifics: Date & Time */}
              {modalType === 'reserve' && (
                <div className="grid grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2 pl-1">Date</label>
                    <input 
                      type="date"
                      min={new Date().toISOString().split('T')[0]}
                      value={formData.date}
                      onChange={(e) => setFormData({...formData, date: e.target.value})}
                      className="w-full px-5 py-4 rounded-2xl border-2 border-slate-100 bg-slate-50 focus:bg-white focus:border-[#75BDE0] focus:ring-4 focus:ring-[#75BDE0]/20 outline-none transition-all font-medium text-slate-700"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2 pl-1">Time</label>
                    <input 
                      type="time"
                      min="07:00"
                      max="23:59"
                      value={formData.time}
                      onChange={(e) => setFormData({...formData, time: e.target.value})}
                      className="w-full px-5 py-4 rounded-2xl border-2 border-slate-100 bg-slate-50 focus:bg-white focus:border-[#75BDE0] focus:ring-4 focus:ring-[#75BDE0]/20 outline-none transition-all font-medium text-slate-700"
                    />
                    <p className="text-xs font-bold text-slate-400 mt-2 pl-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> 7:00 AM - 11:59 PM
                    </p>
                  </div>
                </div>
              )}

              {/* 3. Walk-In Specifics: Duration & Open Time */}
              {modalType === 'walkin' && (
                <div className="space-y-5">
                  <div className={`transition-all duration-300 ${formData.isOpenTime ? 'opacity-40 grayscale pointer-events-none scale-95' : 'scale-100'}`}>
                    <label className="block text-sm font-bold text-slate-700 mb-2 pl-1">
                      Hours Playing
                    </label>
                    <div className="relative">
                      <input 
                        type="number"
                        min="1"
                        max="12"
                        value={formData.duration}
                        onChange={(e) => setFormData({...formData, duration: e.target.value})}
                        className="w-full pl-5 pr-16 py-4 rounded-2xl border-2 border-slate-100 bg-slate-50 focus:bg-white focus:border-[#75BDE0] focus:ring-4 focus:ring-[#75BDE0]/20 outline-none transition-all text-lg font-medium text-slate-700"
                      />
                      <span className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 font-bold bg-slate-100 px-2 py-1 rounded-lg">Hrs</span>
                    </div>
                  </div>
                  
                  {/* Open Time Toggle Button */}
                  <button
                    type="button"
                    onClick={handleOpenTimeToggle}
                    className={`w-full py-4 px-6 rounded-2xl flex items-center justify-center gap-3 border-2 transition-all font-bold text-lg shadow-sm ${
                      formData.isOpenTime 
                        ? 'bg-[#75BDE0] text-white border-transparent shadow-lg shadow-[#75BDE0]/30 scale-[1.02]' 
                        : 'bg-white text-slate-600 border-slate-200 hover:border-[#F8BC9B] hover:bg-[#F8BC9B]/5'
                    }`}
                  >
                    {formData.isOpenTime ? (
                      <><Infinity className="w-6 h-6" /> Open Time Selected</>
                    ) : (
                      <><Infinity className="w-6 h-6 text-slate-400" /> Switch to Open Time</>
                    )}
                  </button>

                  {/* Warning if constrained by reservation */}
                  {renderOpenTimeWarning()}

                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="bg-red-50 border-2 border-red-100 text-red-700 p-4 rounded-2xl flex items-start gap-3 animate-in fade-in zoom-in-95 shadow-sm">
                  <div className="p-1 bg-red-100 rounded-full flex-shrink-0">
                    <AlertCircle className="w-5 h-5 text-red-600" />
                  </div>
                  <p className="font-medium mt-0.5">{error}</p>
                </div>
              )}

            </div>

            {/* Modal Footer with Actions */}
            <div className="p-8 pt-0 flex gap-4">
              <button
                onClick={closeModal}
                className="flex-1 py-4 text-slate-700 bg-slate-100 hover:bg-slate-200 font-bold rounded-2xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                className={`flex-1 py-4 text-white font-bold rounded-2xl shadow-md transition-all hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 ${
                    modalType === 'walkin' || modalType === 'edit'
                      ? 'bg-[#75BDE0] hover:bg-[#64a9cc]'
                      : 'bg-[#F89B9B] hover:bg-[#e88b8b]'
                }`}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default App;