import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth }       from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, enableIndexedDbPersistence }  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBK3k_gFeKz99zN907gLBFWrUVnu1TLSUk",
  authDomain: "maispromo-81a2d.firebaseapp.com",
  projectId: "maispromo-81a2d",
  storageBucket: "maispromo-81a2d.firebasestorage.app",
  messagingSenderId: "1043075027300",
  appId: "1:1043075027300:web:eef047e4d6af83e450aa71",
  measurementId: "G-CCGYJCDBZF"
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

// Ativa o cache offline
enableIndexedDbPersistence(db).catch(err => {
  console.log("Aviso de persistência:", err.code);
});

export { auth, db };
