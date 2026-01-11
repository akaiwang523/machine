import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// ▼▼▼ 這裡請務必換成您剛剛在 Firebase 後台複製的那一串 Config ▼▼▼
// 如果您忘記複製，請去 Firebase Console -> 專案設定 (齒輪圖示) -> 一般 -> 下滑到底部就看得到
const firebaseConfig = {
  apiKey: "AIzaSyCPM6djPYyZ_zMyf8fJ2qRnayHnLXIj-NE",
  authDomain: "machine-45f27.firebaseapp.com",
  projectId: "machine-45f27",
  storageBucket: "machine-45f27.firebasestorage.app",
  messagingSenderId: "576671716540",
  appId: "1:576671716540:web:429d8ad780dfddfd2c2cb9",
  measurementId: "G-2874L084WT"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
