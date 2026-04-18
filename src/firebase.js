

import { initializeApp } from "firebase/app"
import { getFirestore } from "firebase/firestore"

// 🔥 把這裡換成你的 Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyDtyyeAxq-TSBQpsdVY7hbJNrxs5FZxMH0",
  authDomain: "planner-app-bb94f.firebaseapp.com",
  projectId: "planner-app-bb94f",
  storageBucket: "planner-app-bb94f.firebasestorage.app",
  messagingSenderId: "114449778791",
  appId: "1:114449778791:web:57a9aec93c66f56c926cc2"
}

// 初始化 Firebase
const app = initializeApp(firebaseConfig)

// 🔥 Firestore（資料庫）
export const db = getFirestore(app)