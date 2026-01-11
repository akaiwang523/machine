import { useState, useEffect } from 'react';
// 1. 引入 Firebase 功能
import { db } from './firebase';
import { 
  collection,     // 指定集合(資料夾)
  addDoc,         // 新增資料
  deleteDoc,      // 刪除資料
  doc,            // 指定單一文件
  onSnapshot,     // ⭐ 即時監聽 (這就是同步的關鍵)
  query, 
  orderBy 
} from 'firebase/firestore';

// --- 設備與時間設定 (保持不變) ---
const EQUIPMENT_LIST = [
  { id: 'projector', name: '投影機', icon: '📽️' },
  { id: 'mobile-screen', name: '移動式螢幕', icon: '🖥️' },
];

const TIME_OPTIONS = [];
for (let h = 8; h <= 21; h++) {
  for (let m = 0; m < 60; m += 30) {
    if (h === 21 && m > 0) break;
    const hour = h.toString().padStart(2, '0');
    const minute = m.toString().padStart(2, '0');
    TIME_OPTIONS.push(`${hour}:${minute}`);
  }
}

const timeToMinutes = (time) => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

const isTimeOverlap = (start1, end1, start2, end2) => {
  const s1 = timeToMinutes(start1);
  const e1 = timeToMinutes(end1);
  const s2 = timeToMinutes(start2);
  const e2 = timeToMinutes(end2);
  return s1 < e2 && s2 < e1;
};

const formatDate = (dateStr) => {
  const date = new Date(dateStr);
  const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' };
  return date.toLocaleDateString('zh-TW', options);
};

export default function App() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('form');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [notification, setNotification] = useState(null);
  
  const [formData, setFormData] = useState({
    userName: '',
    equipmentId: '',
    date: new Date().toISOString().split('T')[0],
    startTime: '09:00',
    endTime: '10:00',
    password: '', // 預約密碼
  });
  const [formErrors, setFormErrors] = useState({});

  // 2. ⭐ 修改：改用 Firebase 即時監聽
  // 不需要 loadBookings 了，因為 onSnapshot 會自動更新
  useEffect(() => {
    // 建立查詢：去 'bookings' 集合抓資料，依照日期排序
    const q = query(collection(db, "bookings"), orderBy("date"), orderBy("startTime"));
    
    // 開啟監聽器 (只要資料庫有變動，這裡馬上會執行)
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const remoteBookings = snapshot.docs.map(doc => ({
        id: doc.id, // Firebase 的亂數 ID
        ...doc.data()
      }));
      setBookings(remoteBookings);
      setLoading(false);
    });

    // 當使用者離開頁面時，關閉監聽
    return () => unsubscribe();
  }, []);

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.userName.trim()) errors.userName = '請輸入預約人姓名';
    if (!formData.equipmentId) errors.equipmentId = '請選擇設備';
    if (!formData.date) errors.date = '請選擇日期';
    if (!formData.password) errors.password = '請設定刪除密碼'; // 必填密碼

    const startMinutes = timeToMinutes(formData.startTime);
    const endMinutes = timeToMinutes(formData.endTime);
    
    if (endMinutes <= startMinutes) {
      errors.time = '結束時間必須晚於開始時間';
    }
    
    const conflictingBooking = bookings.find(booking => 
      booking.equipmentId === formData.equipmentId &&
      booking.date === formData.date &&
      isTimeOverlap(formData.startTime, formData.endTime, booking.startTime, booking.endTime)
    );
    
    if (conflictingBooking) {
      const equipment = EQUIPMENT_LIST.find(e => e.id === formData.equipmentId);
      errors.conflict = `時間衝突！已被 ${conflictingBooking.userName} 預約`;
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // 3. ⭐ 修改：新增資料到 Firebase
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    
    try {
      // 不需要自己 generateId，Firebase 會自動產生
      await addDoc(collection(db, "bookings"), {
        userName: formData.userName.trim(),
        equipmentId: formData.equipmentId,
        date: formData.date,
        startTime: formData.startTime,
        endTime: formData.endTime,
        password: formData.password, // 存入密碼
        createdAt: new Date().toISOString(),
      });
      
      showNotification('預約成功！', 'success');
      
      setFormData({
        userName: '',
        equipmentId: '',
        date: new Date().toISOString().split('T')[0],
        startTime: '09:00',
        endTime: '10:00',
        password: '',
      });
      setFormErrors({});
    } catch (error) {
      console.error("Error adding document: ", error);
      showNotification('連線錯誤，請重試', 'error');
    }
  };

  // 4. ⭐ 修改：從 Firebase 刪除資料
  const handleCancelBooking = async (bookingId) => {
    const bookingToDelete = bookings.find(b => b.id === bookingId);
    if (!bookingToDelete) return;

    // 密碼檢查
    const inputPwd = prompt(`請輸入預約密碼以刪除「${bookingToDelete.userName}」的預約：`);
    
    if (inputPwd === bookingToDelete.password) {
      try {
        // 刪除雲端資料
        await deleteDoc(doc(db, "bookings", bookingId));
        showNotification('預約已刪除，同步更新中', 'info');
      } catch (error) {
        showNotification('刪除失敗', 'error');
      }
    } else if (inputPwd !== null) {
      alert('密碼錯誤！');
    }
  };

  // 取得設備的每日預約狀態 (跟之前一樣，只是資料來源變了)
  const getEquipmentSchedule = (equipmentId, date) => {
    return bookings.filter(b => b.equipmentId === equipmentId && b.date === date);
  };
  
  // (其餘 UI 顯示邏輯與樣式 保持不變，請直接複製之前的 styles 和 JSX 部分)
  // 為了節省篇幅，我這裡省略了中間重複的 JSX 和 Styles
  // 請保留原本的 return (...) 和 styles 物件，
  // 唯一的差別是把 input 加入 password 欄位
  
  // ... (這裡請貼上原本的 return JSX，記得在表單裡加上密碼輸入框)
  // ... (這裡請貼上原本的 styles)
  
  // 這裡我補上表單裡要新增的密碼輸入框 JSX 片段，請塞在「日期」下面：
  /*
    <div style={styles.formGroup}>
      <label style={styles.label}>刪除密碼 <span style={styles.required}>*</span></label>
      <input
        type="password"
        value={formData.password}
        onChange={(e) => setFormData({...formData, password: e.target.value})}
        style={styles.input}
        placeholder="刪除時需要輸入"
        maxLength="6"
      />
      {formErrors.password && <p style={styles.errorText}>{formErrors.password}</p>}
    </div>
  */

  // 回傳原本的 UI
  return (
    // ... 請使用上一次完整程式碼的 return 內容，
    // ... 只要記得把上面那個「密碼輸入框」加進去 form 裡面即可。
    // ... 如果你懶得拼湊，告訴我，我再一次給你完整的 500 行代碼。
    <div style={styles.container}>
        {/* ...這部分太長了，請用你現有的 JSX，只需微調表單... */}
         <header style={styles.header}>
            <div style={styles.headerContent}>
            <div style={styles.logo}>
                <span style={styles.logoIcon}>📅</span>
                <h1 style={styles.title}>設備預約管理系統 (雲端同步版)</h1>
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

      <main style={styles.main}>
        {/* 預約表單 */}
        {activeTab === 'form' && (
          <div style={styles.formContainer}>
            <h2 style={styles.sectionTitle}>新增預約</h2>
            <form onSubmit={handleSubmit} style={styles.form}>
              <div style={styles.formGroup}>
                <label style={styles.label}>預約人姓名 <span style={styles.required}>*</span></label>
                <input
                  type="text"
                  value={formData.userName}
                  onChange={(e) => setFormData({...formData, userName: e.target.value})}
                  style={{...styles.input, ...(formErrors.userName ? styles.inputError : {})}}
                  placeholder="請輸入姓名"
                />
                {formErrors.userName && <p style={styles.errorText}>{formErrors.userName}</p>}
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>刪除密碼 (防誤刪) <span style={styles.required}>*</span></label>
                <input
                  type="text"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  style={{...styles.input, ...(formErrors.password ? styles.inputError : {})}}
                  placeholder="請設定一組密碼"
                />
                {formErrors.password && <p style={styles.errorText}>{formErrors.password}</p>}
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>選擇設備 <span style={styles.required}>*</span></label>
                <select
                  value={formData.equipmentId}
                  onChange={(e) => setFormData({...formData, equipmentId: e.target.value})}
                  style={{...styles.select, ...(formErrors.equipmentId ? styles.inputError : {})}}
                >
                  <option value="">-- 請選擇設備 --</option>
                  {EQUIPMENT_LIST.map(eq => (
                    <option key={eq.id} value={eq.id}>{eq.icon} {eq.name}</option>
                  ))}
                </select>
                {formErrors.equipmentId && <p style={styles.errorText}>{formErrors.equipmentId}</p>}
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>日期 <span style={styles.required}>*</span></label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({...formData, date: e.target.value})}
                  min={new Date().toISOString().split('T')[0]}
                  style={{...styles.input, ...(formErrors.date ? styles.inputError : {})}}
                />
                {formErrors.date && <p style={styles.errorText}>{formErrors.date}</p>}
              </div>

              <div style={styles.timeRow}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>開始時間 <span style={styles.required}>*</span></label>
                  <select
                    value={formData.startTime}
                    onChange={(e) => setFormData({...formData, startTime: e.target.value})}
                    style={styles.select}
                  >
                    {TIME_OPTIONS.map(time => <option key={time} value={time}>{time}</option>)}
                  </select>
                </div>
                <div style={styles.timeSeparator}>→</div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>結束時間 <span style={styles.required}>*</span></label>
                  <select
                    value={formData.endTime}
                    onChange={(e) => setFormData({...formData, endTime: e.target.value})}
                    style={styles.select}
                  >
                    {TIME_OPTIONS.map(time => <option key={time} value={time}>{time}</option>)}
                  </select>
                </div>
              </div>
              {formErrors.time && <p style={styles.errorText}>{formErrors.time}</p>}
              {formErrors.conflict && <div style={styles.conflictWarning}><span style={styles.warningIcon}>⚠️</span>{formErrors.conflict}</div>}

              <button type="submit" style={styles.submitButton}>確認預約</button>
            </form>
          </div>
        )}

        {/* 預約看板 (跟之前一樣) */}
        {activeTab === 'calendar' && (
          <div style={styles.calendarContainer}>
            <h2 style={styles.sectionTitle}>預約看板 ({formatDate(selectedDate)})</h2>
            
            {/* 簡易日期切換 */}
            <div style={styles.dateSelector}>
               <input 
                  type="date" 
                  value={selectedDate} 
                  onChange={(e)=>setSelectedDate(e.target.value)}
                  style={styles.input}
               />
            </div>

            <div style={{...styles.scheduleGrid, marginTop: '20px'}}>
              {EQUIPMENT_LIST.map(equipment => {
                const schedules = getEquipmentSchedule(equipment.id, selectedDate);
                return (
                  <div key={equipment.id} style={styles.equipmentCard}>
                    <div style={styles.equipmentHeader}>
                      <span style={styles.equipmentIcon}>{equipment.icon}</span>
                      <span style={styles.equipmentName}>{equipment.name}</span>
                    </div>
                    <div style={styles.scheduleList}>
                      {schedules.length === 0 ? <p style={styles.noSchedule}>今日無預約</p> : 
                        schedules.map(booking => (
                          <div key={booking.id} style={styles.scheduleItem}>
                            <div style={styles.scheduleTime}>{booking.startTime} - {booking.endTime}</div>
                            <div style={styles.scheduleUser}>{booking.userName}</div>
                          </div>
                        ))
                      }
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 列表 (跟之前一樣) */}
        {activeTab === 'list' && (
           <div style={styles.listContainer}>
             <h2 style={styles.sectionTitle}>所有預約</h2>
             {bookings.length === 0 ? <div style={styles.emptyState}>📭 沒有資料</div> : (
               <div style={styles.bookingList}>
                 {bookings.map(booking => {
                    const equipment = EQUIPMENT_LIST.find(e => e.id === booking.equipmentId);
                    return (
                        <div key={booking.id} style={styles.bookingCard}>
                            <div style={styles.bookingCardHeader}>
                                <span style={styles.bookingEquipment}>{equipment?.icon} {equipment?.name}</span>
                                <button onClick={() => handleCancelBooking(booking.id)} style={styles.cancelButton}>刪除</button>
                            </div>
                            <div style={styles.bookingCardBody}>
                                <p>📅 {formatDate(booking.date)} {booking.startTime}-{booking.endTime}</p>
                                <p>👤 {booking.userName}</p>
                            </div>
                        </div>
                    )
                 })}
               </div>
             )}
           </div>
        )}

      </main>
    </div>
  );
}

const styles = {
  container: { minHeight: '100vh', backgroundColor: '#0f172a', color: '#e2e8f0', fontFamily: 'sans-serif' },
  header: { background: '#1e3a5f', padding: '20px' },
  title: { margin: 0, color: 'white' },
  subtitle: { margin: 0, color: '#94a3b8' },
  main: { maxWidth: '800px', margin: '0 auto', padding: '20px' },
  tabContainer: { display: 'flex', gap: '10px', padding: '10px 20px', justifyContent: 'center' },
  tab: { padding: '10px 20px', background: '#1e293b', border: 'none', color: '#94a3b8', borderRadius: '8px', cursor: 'pointer' },
  tabActive: { background: '#3b82f6', color: 'white' },
  formContainer: { background: '#1e293b', padding: '20px', borderRadius: '12px' },
  formGroup: { marginBottom: '15px', display: 'flex', flexDirection: 'column' },
  label: { marginBottom: '5px', color: '#cbd5e1' },
  input: { padding: '10px', borderRadius: '6px', border: '1px solid #475569', background: '#0f172a', color: 'white' },
  select: { padding: '10px', borderRadius: '6px', border: '1px solid #475569', background: '#0f172a', color: 'white' },
  timeRow: { display: 'flex', gap: '10px' },
  submitButton: { width: '100%', padding: '12px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', marginTop: '10px' },
  errorText: { color: '#ef4444', fontSize: '12px' },
  notification: { position: 'fixed', top: '20px', right: '20px', padding: '10px 20px', borderRadius: '8px', color: 'white' },
  scheduleGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' },
  equipmentCard: { background: '#0f172a', padding: '10px', borderRadius: '8px', border: '1px solid #334155' },
  scheduleItem: { borderLeft: '3px solid #3b82f6', paddingLeft: '8px', marginBottom: '8px' },
  scheduleTime: { color: '#3b82f6', fontWeight: 'bold' },
  bookingCard: { background: '#1e293b', marginBottom: '10px', borderRadius: '8px', overflow: 'hidden' },
  bookingCardHeader: { background: '#0f172a', padding: '10px', display: 'flex', justifyContent: 'space-between' },
  bookingCardBody: { padding: '10px' },
  cancelButton: { background: 'transparent', border: '1px solid #ef4444', color: '#ef4444', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer' }
};
