import { useState, useEffect } from 'react';

// 設備列表
const EQUIPMENT_LIST = [
  { id: 'projector', name: '投影機', icon: '📽️' },
  { id: 'mobile-screen', name: '移動式螢幕', icon: '🖥️' },
];

// 時間選項 (30分鐘間隔)
const TIME_OPTIONS = [];
for (let h = 8; h <= 21; h++) {
  for (let m = 0; m < 60; m += 30) {
    if (h === 21 && m > 0) break;
    const hour = h.toString().padStart(2, '0');
    const minute = m.toString().padStart(2, '0');
    TIME_OPTIONS.push(`${hour}:${minute}`);
  }
}

// 生成唯一 ID
const generateId = () => `booking-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// 時間轉分鐘數
const timeToMinutes = (time) => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

// 檢查時間重疊
const isTimeOverlap = (start1, end1, start2, end2) => {
  const s1 = timeToMinutes(start1);
  const e1 = timeToMinutes(end1);
  const s2 = timeToMinutes(start2);
  const e2 = timeToMinutes(end2);
  return s1 < e2 && s2 < e1;
};

// 格式化日期顯示
const formatDate = (dateStr) => {
  const date = new Date(dateStr);
  const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' };
  return date.toLocaleDateString('zh-TW', options);
};

export default function EquipmentBookingSystem() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('form');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedMonth, setSelectedMonth] = useState({ 
    year: new Date().getFullYear(), 
    month: new Date().getMonth() 
  });
  const [notification, setNotification] = useState(null);
  
  // 表單狀態
  const [formData, setFormData] = useState({
    userName: '',
    equipmentId: '',
    date: new Date().toISOString().split('T')[0],
    startTime: '09:00',
    endTime: '10:00',
  });
  const [formErrors, setFormErrors] = useState({});

  // 載入預約資料
  useEffect(() => {
    loadBookings();
  }, []);

  const loadBookings = async () => {
    try {
      const result = await window.storage.get('equipment-bookings');
      if (result && result.value) {
        setBookings(JSON.parse(result.value));
      }
    } catch (error) {
      console.log('No existing bookings found');
    } finally {
      setLoading(false);
    }
  };

  const saveBookings = async (newBookings) => {
    try {
      await window.storage.set('equipment-bookings', JSON.stringify(newBookings));
      setBookings(newBookings);
    } catch (error) {
      console.error('Failed to save bookings:', error);
      showNotification('儲存失敗，請重試', 'error');
    }
  };

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // 驗證表單
  const validateForm = () => {
    const errors = {};
    
    if (!formData.userName.trim()) {
      errors.userName = '請輸入預約人姓名';
    }
    
    if (!formData.equipmentId) {
      errors.equipmentId = '請選擇設備';
    }
    
    if (!formData.date) {
      errors.date = '請選擇日期';
    }
    
    const startMinutes = timeToMinutes(formData.startTime);
    const endMinutes = timeToMinutes(formData.endTime);
    
    if (endMinutes <= startMinutes) {
      errors.time = '結束時間必須晚於開始時間';
    }
    
    // 檢查時間衝突
    const conflictingBooking = bookings.find(booking => 
      booking.equipmentId === formData.equipmentId &&
      booking.date === formData.date &&
      isTimeOverlap(formData.startTime, formData.endTime, booking.startTime, booking.endTime)
    );
    
    if (conflictingBooking) {
      const equipment = EQUIPMENT_LIST.find(e => e.id === formData.equipmentId);
      errors.conflict = `時間衝突！${equipment?.name} 在 ${conflictingBooking.startTime}-${conflictingBooking.endTime} 已被 ${conflictingBooking.userName} 預約`;
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // 提交預約
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    const newBooking = {
      id: generateId(),
      userName: formData.userName.trim(),
      equipmentId: formData.equipmentId,
      date: formData.date,
      startTime: formData.startTime,
      endTime: formData.endTime,
      createdAt: new Date().toISOString(),
    };
    
    const newBookings = [...bookings, newBooking];
    await saveBookings(newBookings);
    
    showNotification('預約成功！', 'success');
    
    // 重置表單
    setFormData({
      userName: '',
      equipmentId: '',
      date: new Date().toISOString().split('T')[0],
      startTime: '09:00',
      endTime: '10:00',
    });
    setFormErrors({});
  };

  // 取消預約
  const handleCancelBooking = async (bookingId) => {
    const newBookings = bookings.filter(b => b.id !== bookingId);
    await saveBookings(newBookings);
    showNotification('預約已取消', 'info');
  };

  // 取得特定日期的預約
  const getBookingsForDate = (date) => {
    return bookings.filter(b => b.date === date).sort((a, b) => 
      timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
    );
  };

  // 取得設備的每日預約狀態
  const getEquipmentSchedule = (equipmentId, date) => {
    return bookings.filter(b => b.equipmentId === equipmentId && b.date === date);
  };

  // 取得指定月份的所有日期
  const getDatesInMonth = (year, month) => {
    const dates = [];
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date = new Date(year, month, d);
      // 只顯示今天及之後的日期
      if (date >= today) {
        dates.push(date.toISOString().split('T')[0]);
      }
    }
    return dates;
  };

  // 生成未來 6 個月的月份選項
  const getMonthOptions = () => {
    const months = [];
    const today = new Date();
    for (let i = 0; i < 6; i++) {
      const date = new Date(today.getFullYear(), today.getMonth() + i, 1);
      months.push({
        year: date.getFullYear(),
        month: date.getMonth(),
        label: date.toLocaleDateString('zh-TW', { year: 'numeric', month: 'long' })
      });
    }
    return months;
  };

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.loadingSpinner}></div>
        <p style={styles.loadingText}>載入中...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* 頁首 */}
      <header style={styles.header}>
        <div style={styles.headerContent}>
          <div style={styles.logo}>
            <span style={styles.logoIcon}>📅</span>
            <h1 style={styles.title}>設備預約管理系統</h1>
          </div>
          <p style={styles.subtitle}>Equipment Booking System</p>
        </div>
      </header>

      {/* 通知 */}
      {notification && (
        <div style={{
          ...styles.notification,
          backgroundColor: notification.type === 'error' ? '#ef4444' : 
                          notification.type === 'info' ? '#3b82f6' : '#10b981',
        }}>
          {notification.message}
        </div>
      )}

      {/* 標籤頁切換 */}
      <div style={styles.tabContainer}>
        <button
          style={{...styles.tab, ...(activeTab === 'form' ? styles.tabActive : {})}}
          onClick={() => setActiveTab('form')}
        >
          <span style={styles.tabIcon}>✏️</span>
          新增預約
        </button>
        <button
          style={{...styles.tab, ...(activeTab === 'calendar' ? styles.tabActive : {})}}
          onClick={() => setActiveTab('calendar')}
        >
          <span style={styles.tabIcon}>📊</span>
          預約看板
        </button>
        <button
          style={{...styles.tab, ...(activeTab === 'list' ? styles.tabActive : {})}}
          onClick={() => setActiveTab('list')}
        >
          <span style={styles.tabIcon}>📋</span>
          所有預約 ({bookings.length})
        </button>
      </div>

      {/* 主內容區 */}
      <main style={styles.main}>
        {/* 預約表單 */}
        {activeTab === 'form' && (
          <div style={styles.formContainer}>
            <h2 style={styles.sectionTitle}>新增預約</h2>
            <form onSubmit={handleSubmit} style={styles.form}>
              {/* 預約人姓名 */}
              <div style={styles.formGroup}>
                <label style={styles.label}>
                  預約人姓名 <span style={styles.required}>*</span>
                </label>
                <input
                  type="text"
                  value={formData.userName}
                  onChange={(e) => setFormData({...formData, userName: e.target.value})}
                  style={{...styles.input, ...(formErrors.userName ? styles.inputError : {})}}
                  placeholder="請輸入姓名"
                />
                {formErrors.userName && <p style={styles.errorText}>{formErrors.userName}</p>}
              </div>

              {/* 選擇設備 */}
              <div style={styles.formGroup}>
                <label style={styles.label}>
                  選擇設備 <span style={styles.required}>*</span>
                </label>
                <select
                  value={formData.equipmentId}
                  onChange={(e) => setFormData({...formData, equipmentId: e.target.value})}
                  style={{...styles.select, ...(formErrors.equipmentId ? styles.inputError : {})}}
                >
                  <option value="">-- 請選擇設備 --</option>
                  {EQUIPMENT_LIST.map(eq => (
                    <option key={eq.id} value={eq.id}>
                      {eq.icon} {eq.name}
                    </option>
                  ))}
                </select>
                {formErrors.equipmentId && <p style={styles.errorText}>{formErrors.equipmentId}</p>}
              </div>

              {/* 日期 */}
              <div style={styles.formGroup}>
                <label style={styles.label}>
                  日期 <span style={styles.required}>*</span>
                </label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({...formData, date: e.target.value})}
                  min={new Date().toISOString().split('T')[0]}
                  style={{...styles.input, ...(formErrors.date ? styles.inputError : {})}}
                />
                {formErrors.date && <p style={styles.errorText}>{formErrors.date}</p>}
              </div>

              {/* 時間選擇 */}
              <div style={styles.timeRow}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    開始時間 <span style={styles.required}>*</span>
                  </label>
                  <select
                    value={formData.startTime}
                    onChange={(e) => setFormData({...formData, startTime: e.target.value})}
                    style={styles.select}
                  >
                    {TIME_OPTIONS.map(time => (
                      <option key={time} value={time}>{time}</option>
                    ))}
                  </select>
                </div>
                <div style={styles.timeSeparator}>→</div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    結束時間 <span style={styles.required}>*</span>
                  </label>
                  <select
                    value={formData.endTime}
                    onChange={(e) => setFormData({...formData, endTime: e.target.value})}
                    style={styles.select}
                  >
                    {TIME_OPTIONS.map(time => (
                      <option key={time} value={time}>{time}</option>
                    ))}
                  </select>
                </div>
              </div>
              {formErrors.time && <p style={styles.errorText}>{formErrors.time}</p>}

              {/* 衝突警告 */}
              {formErrors.conflict && (
                <div style={styles.conflictWarning}>
                  <span style={styles.warningIcon}>⚠️</span>
                  {formErrors.conflict}
                </div>
              )}

              {/* 提交按鈕 */}
              <button type="submit" style={styles.submitButton}>
                確認預約
              </button>
            </form>
          </div>
        )}

        {/* 預約看板 */}
        {activeTab === 'calendar' && (
          <div style={styles.calendarContainer}>
            <h2 style={styles.sectionTitle}>預約看板</h2>
            
            {/* 月份選擇 */}
            <div style={styles.monthSelector}>
              {getMonthOptions().map((m, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setSelectedMonth({ year: m.year, month: m.month });
                    // 自動選擇該月份的第一個可用日期
                    const dates = getDatesInMonth(m.year, m.month);
                    if (dates.length > 0) {
                      setSelectedDate(dates[0]);
                    }
                  }}
                  style={{
                    ...styles.monthButton,
                    ...(selectedMonth.year === m.year && selectedMonth.month === m.month ? styles.monthButtonActive : {}),
                  }}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {/* 日期選擇 */}
            <div style={styles.dateSelector}>
              {getDatesInMonth(selectedMonth.year, selectedMonth.month).map(date => (
                <button
                  key={date}
                  onClick={() => setSelectedDate(date)}
                  style={{
                    ...styles.dateButton,
                    ...(selectedDate === date ? styles.dateButtonActive : {}),
                  }}
                >
                  <span style={styles.dateDay}>
                    {new Date(date).toLocaleDateString('zh-TW', { weekday: 'short' })}
                  </span>
                  <span style={styles.dateNumber}>
                    {new Date(date).getDate()}
                  </span>
                </button>
              ))}
            </div>

            <p style={styles.selectedDateLabel}>{formatDate(selectedDate)}</p>

            {/* 設備時間表 */}
            <div style={styles.scheduleGrid}>
              {EQUIPMENT_LIST.map(equipment => {
                const schedules = getEquipmentSchedule(equipment.id, selectedDate);
                return (
                  <div key={equipment.id} style={styles.equipmentCard}>
                    <div style={styles.equipmentHeader}>
                      <span style={styles.equipmentIcon}>{equipment.icon}</span>
                      <span style={styles.equipmentName}>{equipment.name}</span>
                    </div>
                    <div style={styles.scheduleList}>
                      {schedules.length === 0 ? (
                        <p style={styles.noSchedule}>今日無預約</p>
                      ) : (
                        schedules.map(booking => (
                          <div key={booking.id} style={styles.scheduleItem}>
                            <div style={styles.scheduleTime}>
                              {booking.startTime} - {booking.endTime}
                            </div>
                            <div style={styles.scheduleUser}>
                              {booking.userName}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 所有預約列表 */}
        {activeTab === 'list' && (
          <div style={styles.listContainer}>
            <h2 style={styles.sectionTitle}>所有預約</h2>
            
            {bookings.length === 0 ? (
              <div style={styles.emptyState}>
                <span style={styles.emptyIcon}>📭</span>
                <p>目前沒有任何預約</p>
              </div>
            ) : (
              <div style={styles.bookingList}>
                {[...bookings]
                  .sort((a, b) => new Date(a.date + 'T' + a.startTime) - new Date(b.date + 'T' + b.startTime))
                  .map(booking => {
                    const equipment = EQUIPMENT_LIST.find(e => e.id === booking.equipmentId);
                    const isPast = new Date(booking.date + 'T' + booking.endTime) < new Date();
                    return (
                      <div 
                        key={booking.id} 
                        style={{
                          ...styles.bookingCard,
                          ...(isPast ? styles.bookingCardPast : {}),
                        }}
                      >
                        <div style={styles.bookingCardHeader}>
                          <span style={styles.bookingEquipment}>
                            {equipment?.icon} {equipment?.name}
                          </span>
                          {isPast && <span style={styles.pastBadge}>已過期</span>}
                        </div>
                        <div style={styles.bookingCardBody}>
                          <div style={styles.bookingInfo}>
                            <p style={styles.bookingDate}>📅 {formatDate(booking.date)}</p>
                            <p style={styles.bookingTime}>🕐 {booking.startTime} - {booking.endTime}</p>
                            <p style={styles.bookingUser}>👤 {booking.userName}</p>
                          </div>
                          {!isPast && (
                            <button
                              onClick={() => handleCancelBooking(booking.id)}
                              style={styles.cancelButton}
                            >
                              取消預約
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* 頁尾 */}
      <footer style={styles.footer}>
        <p>Equipment Booking System © 2025</p>
      </footer>
    </div>
  );
}

// 樣式
const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#0f172a',
    color: '#e2e8f0',
    fontFamily: '"Noto Sans TC", "Segoe UI", sans-serif',
  },
  loadingContainer: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f172a',
  },
  loadingSpinner: {
    width: '48px',
    height: '48px',
    border: '4px solid #334155',
    borderTopColor: '#3b82f6',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  loadingText: {
    marginTop: '16px',
    color: '#94a3b8',
    fontSize: '14px',
  },
  header: {
    background: 'linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%)',
    padding: '24px 20px',
    borderBottom: '1px solid #334155',
  },
  headerContent: {
    maxWidth: '1000px',
    margin: '0 auto',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  logoIcon: {
    fontSize: '32px',
  },
  title: {
    fontSize: '24px',
    fontWeight: '700',
    margin: 0,
    color: '#f8fafc',
  },
  subtitle: {
    fontSize: '13px',
    color: '#64748b',
    marginTop: '4px',
    marginLeft: '44px',
  },
  notification: {
    position: 'fixed',
    top: '20px',
    right: '20px',
    padding: '12px 20px',
    borderRadius: '8px',
    color: 'white',
    fontWeight: '500',
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
    zIndex: 1000,
    animation: 'slideIn 0.3s ease',
  },
  tabContainer: {
    display: 'flex',
    gap: '8px',
    padding: '16px 20px',
    maxWidth: '1000px',
    margin: '0 auto',
    overflowX: 'auto',
  },
  tab: {
    flex: '1',
    minWidth: '120px',
    padding: '12px 16px',
    border: 'none',
    borderRadius: '8px',
    backgroundColor: '#1e293b',
    color: '#94a3b8',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    transition: 'all 0.2s',
  },
  tabActive: {
    backgroundColor: '#3b82f6',
    color: 'white',
  },
  tabIcon: {
    fontSize: '16px',
  },
  main: {
    maxWidth: '1000px',
    margin: '0 auto',
    padding: '20px',
  },
  sectionTitle: {
    fontSize: '20px',
    fontWeight: '600',
    marginBottom: '20px',
    color: '#f1f5f9',
  },
  formContainer: {
    backgroundColor: '#1e293b',
    borderRadius: '12px',
    padding: '24px',
    border: '1px solid #334155',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    flex: 1,
  },
  label: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#cbd5e1',
  },
  required: {
    color: '#ef4444',
  },
  input: {
    padding: '12px 16px',
    borderRadius: '8px',
    border: '1px solid #475569',
    backgroundColor: '#0f172a',
    color: '#f8fafc',
    fontSize: '15px',
    outline: 'none',
    transition: 'border-color 0.2s',
  },
  inputError: {
    borderColor: '#ef4444',
  },
  select: {
    padding: '12px 16px',
    borderRadius: '8px',
    border: '1px solid #475569',
    backgroundColor: '#0f172a',
    color: '#f8fafc',
    fontSize: '15px',
    outline: 'none',
    cursor: 'pointer',
  },
  timeRow: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: '12px',
  },
  timeSeparator: {
    paddingBottom: '14px',
    color: '#64748b',
    fontSize: '18px',
  },
  errorText: {
    fontSize: '13px',
    color: '#ef4444',
    margin: 0,
  },
  conflictWarning: {
    padding: '16px',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid #ef4444',
    borderRadius: '8px',
    color: '#fca5a5',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  warningIcon: {
    fontSize: '20px',
  },
  submitButton: {
    padding: '14px 24px',
    backgroundColor: '#3b82f6',
    border: 'none',
    borderRadius: '8px',
    color: 'white',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
    marginTop: '8px',
  },
  calendarContainer: {
    backgroundColor: '#1e293b',
    borderRadius: '12px',
    padding: '24px',
    border: '1px solid #334155',
  },
  monthSelector: {
    display: 'flex',
    gap: '8px',
    overflowX: 'auto',
    paddingBottom: '16px',
    marginBottom: '8px',
    borderBottom: '1px solid #334155',
  },
  monthButton: {
    padding: '10px 16px',
    border: '1px solid #475569',
    borderRadius: '8px',
    backgroundColor: '#0f172a',
    color: '#94a3b8',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    whiteSpace: 'nowrap',
    transition: 'all 0.2s',
  },
  monthButtonActive: {
    backgroundColor: '#1e3a5f',
    borderColor: '#3b82f6',
    color: '#3b82f6',
  },
  dateSelector: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    paddingBottom: '8px',
  },
  dateButton: {
    padding: '12px 16px',
    border: '1px solid #475569',
    borderRadius: '8px',
    backgroundColor: '#0f172a',
    color: '#94a3b8',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
    minWidth: '60px',
    transition: 'all 0.2s',
  },
  dateButtonActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
    color: 'white',
  },
  dateDay: {
    fontSize: '11px',
    fontWeight: '500',
  },
  dateNumber: {
    fontSize: '18px',
    fontWeight: '700',
  },
  selectedDateLabel: {
    textAlign: 'center',
    color: '#64748b',
    fontSize: '14px',
    margin: '16px 0',
  },
  scheduleGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '16px',
  },
  equipmentCard: {
    backgroundColor: '#0f172a',
    borderRadius: '10px',
    border: '1px solid #334155',
    overflow: 'hidden',
  },
  equipmentHeader: {
    padding: '14px 16px',
    backgroundColor: '#1e3a5f',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    borderBottom: '1px solid #334155',
  },
  equipmentIcon: {
    fontSize: '20px',
  },
  equipmentName: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#f1f5f9',
  },
  scheduleList: {
    padding: '12px',
    minHeight: '80px',
  },
  noSchedule: {
    color: '#64748b',
    fontSize: '13px',
    textAlign: 'center',
    padding: '20px 0',
  },
  scheduleItem: {
    padding: '10px 12px',
    backgroundColor: '#1e293b',
    borderRadius: '6px',
    marginBottom: '8px',
    borderLeft: '3px solid #3b82f6',
  },
  scheduleTime: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#3b82f6',
  },
  scheduleUser: {
    fontSize: '13px',
    color: '#94a3b8',
    marginTop: '4px',
  },
  listContainer: {
    backgroundColor: '#1e293b',
    borderRadius: '12px',
    padding: '24px',
    border: '1px solid #334155',
  },
  emptyState: {
    textAlign: 'center',
    padding: '48px 20px',
    color: '#64748b',
  },
  emptyIcon: {
    fontSize: '48px',
    display: 'block',
    marginBottom: '16px',
  },
  bookingList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  bookingCard: {
    backgroundColor: '#0f172a',
    borderRadius: '10px',
    border: '1px solid #334155',
    overflow: 'hidden',
  },
  bookingCardPast: {
    opacity: 0.6,
  },
  bookingCardHeader: {
    padding: '12px 16px',
    backgroundColor: '#1e3a5f',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid #334155',
  },
  bookingEquipment: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#f1f5f9',
  },
  pastBadge: {
    fontSize: '11px',
    padding: '4px 8px',
    backgroundColor: '#64748b',
    borderRadius: '4px',
    color: '#e2e8f0',
  },
  bookingCardBody: {
    padding: '16px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '16px',
    flexWrap: 'wrap',
  },
  bookingInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  bookingDate: {
    fontSize: '14px',
    color: '#cbd5e1',
    margin: 0,
  },
  bookingTime: {
    fontSize: '14px',
    color: '#3b82f6',
    fontWeight: '500',
    margin: 0,
  },
  bookingUser: {
    fontSize: '14px',
    color: '#94a3b8',
    margin: 0,
  },
  bookingContact: {
    fontSize: '13px',
    color: '#64748b',
    margin: 0,
  },
  cancelButton: {
    padding: '8px 16px',
    backgroundColor: 'transparent',
    border: '1px solid #ef4444',
    borderRadius: '6px',
    color: '#ef4444',
    fontSize: '13px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  footer: {
    textAlign: 'center',
    padding: '24px',
    color: '#475569',
    fontSize: '13px',
    borderTop: '1px solid #1e293b',
  },
};

// CSS 動畫
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  @keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  input:focus, select:focus {
    border-color: #3b82f6 !important;
  }
  button:hover {
    filter: brightness(1.1);
  }
  .cancelButton:hover {
    background-color: rgba(239, 68, 68, 0.1) !important;
  }
`;
document.head.appendChild(styleSheet);
