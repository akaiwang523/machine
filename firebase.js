// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCPM6djPYyZ_zMyf8fJ2qRnayHnLXIj-NE",
  authDomain: "machine-45f27.firebaseapp.com",
  projectId: "machine-45f27",
  storageBucket: "machine-45f27.firebasestorage.app",
  messagingSenderId: "576671716540",
  appId: "1:576671716540:web:429d8ad780dfddfd2c2cb9",
  measurementId: "G-2874L084WT"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
