# 🎥 WebRTC Video Call – Frontend

A modern React-based video calling application built using WebRTC and Socket.IO.

Live Demo:
https://videooocall.netlify.app

---

## 🚀 Tech Stack

- React (Vite)
- WebRTC
- Socket.IO Client
- Lucide Icons
- CSS Modules
- Netlify (Deployment)

---

## 📡 How It Works

This application enables peer-to-peer video calls using WebRTC.

Flow:

1. User creates a room.
2. Another user joins using the Room ID.
3. Host creates an SDP Offer.
4. Guest sends back an SDP Answer.
5. ICE candidates are exchanged.
6. Direct peer-to-peer video connection is established.

After connection, video/audio streams go directly between users.
The server is only used for signaling.

---

## 🧠 What is WebRTC?

WebRTC (Web Real-Time Communication) is a browser technology that allows:

- Video calls
- Audio calls
- Peer-to-peer data transfer

It works using:

- getUserMedia()
- RTCPeerConnection
- ICE Candidates
- STUN/TURN servers

WebRTC requires HTTPS in production.

---

## 🛠 Run Locally

```bash
npm install
npm run dev
```

---

## 🌍 Deployment

Frontend is deployed on Netlify.

Make sure to update:

```
VITE_SOCKET_URL=https://your-render-backend.onrender.com
```

---

## 👨‍💻 Author

![Profile](YOUR_PROFILE_IMAGE_LINK)

**Bala**

GitHub: https://github.com/Balakrishnamoorthy 
Portfolio: https://balakrishnamoorthy-portfolio.netlify.app/