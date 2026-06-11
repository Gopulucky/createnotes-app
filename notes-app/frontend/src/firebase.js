import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAVk33rOtiV8OVCtnaKgVW0lW1oX-mTOp0",
  authDomain: "createnotes-8fb7c.firebaseapp.com",
  projectId: "createnotes-8fb7c",
  storageBucket: "createnotes-8fb7c.firebasestorage.app",
  messagingSenderId: "549017320804",
  appId: "1:549017320804:web:09cba19f1c74a3b465ce71",
  measurementId: "G-GVRLTFKEJE"
};

const app = initializeApp(firebaseConfig);
export const analytics = getAnalytics(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
