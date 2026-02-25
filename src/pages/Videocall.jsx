import React, { useRef, useState, useEffect } from "react";
import { io } from "socket.io-client";
import { Mic, MicOff, Video, VideoOff, PhoneOff, Copy, Check, Monitor, MonitorOff, MessageCircle, Send, Paperclip } from "lucide-react";
import { Download, File as FileIcon } from "lucide-react";

import styles from "../styles/Videocall.module.css";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

const socket = io(SOCKET_URL);

const VideoCall = () => {
    const localVideo = useRef();
    const remoteVideo = useRef();
    const peerConnection = useRef();
    const localStream = useRef(null);

    const [isMuted, setIsMuted] = useState(false);
    const [isCameraOff, setIsCameraOff] = useState(false);
    const [copied, setCopied] = useState(false);

    const [roomId, setRoomId] = useState("");
    const [inputRoom, setInputRoom] = useState("");
    const [isHost, setIsHost] = useState(false);

    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const screenStream = useRef(null);

    const dataChannel = useRef(null);
    const [messages, setMessages] = useState([]);
    const [chatInput, setChatInput] = useState("");
    const [isChatOpen, setIsChatOpen] = useState(false);

    const fileInputRef = useRef(null);
    const receivedBuffers = useRef([]);
    const receivedFileInfo = useRef(null);

    useEffect(() => {
        const handleVisibilityChange = () => {
            if (!document.hidden) {
                console.log("Tab active again");

                if (remoteVideo.current?.srcObject) {
                    remoteVideo.current.play().catch(() => { });
                }

                if (localVideo.current?.srcObject) {
                    localVideo.current.play().catch(() => { });
                }
            }
        };

        document.addEventListener("visibilitychange", handleVisibilityChange);

        return () => {
            document.removeEventListener("visibilitychange", handleVisibilityChange);
        };
    }, []);

    const createConnection = async (room, host) => {
        setIsHost(host);

        const stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
        });

        // localVideo.current.srcObject = stream;
        localStream.current = stream;
        localVideo.current.srcObject = stream;

        peerConnection.current = new RTCPeerConnection({
            iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
        });

        if (host) {
            dataChannel.current = peerConnection.current.createDataChannel("chat");

            dataChannel.current.onmessage = async (event) => {
                if (typeof event.data === "string") {
                    const parsed = JSON.parse(event.data);

                    if (parsed.type === "chat") {
                        setMessages((prev) => [
                            ...prev,
                            { type: "chat", sender: "remote", text: parsed.text },
                        ]);
                    }

                    if (parsed.type === "file-info") {
                        receivedFileInfo.current = parsed;
                        receivedBuffers.current = [];
                    }
                } else {
                    // Binary chunk
                    receivedBuffers.current.push(event.data);

                    const totalSize = receivedBuffers.current.reduce(
                        (acc, chunk) => acc + chunk.byteLength,
                        0
                    );

                    if (totalSize >= receivedFileInfo.current.size) {
                        const blob = new Blob(receivedBuffers.current);

                        setMessages((prev) => [
                            ...prev,
                            {
                                type: "file",
                                sender: "remote",
                                name: receivedFileInfo.current.name,
                                size: receivedFileInfo.current.size,
                                blob: blob,
                            },
                        ]);

                        receivedBuffers.current = [];
                    }
                }
            };
        }

        peerConnection.current.ondatachannel = (event) => {
            dataChannel.current = event.channel;

            dataChannel.current.onmessage = async (event) => {
                if (typeof event.data === "string") {
                    const parsed = JSON.parse(event.data);

                    if (parsed.type === "chat") {
                        setMessages((prev) => [
                            ...prev,
                            { type: "chat", sender: "remote", text: parsed.text },
                        ]);
                    }

                    if (parsed.type === "file-info") {
                        receivedFileInfo.current = parsed;
                        receivedBuffers.current = [];
                    }
                } else {
                    // Binary chunk
                    receivedBuffers.current.push(event.data);

                    const totalSize = receivedBuffers.current.reduce(
                        (acc, chunk) => acc + chunk.byteLength,
                        0
                    );

                    if (totalSize >= receivedFileInfo.current.size) {
                        const blob = new Blob(receivedBuffers.current);

                        setMessages((prev) => [
                            ...prev,
                            {
                                type: "file",
                                sender: "remote",
                                name: receivedFileInfo.current.name,
                                size: receivedFileInfo.current.size,
                                blob: blob,
                            },
                        ]);

                        receivedBuffers.current = [];
                    }
                }
            };
        };

        stream.getTracks().forEach((track) => {
            peerConnection.current.addTrack(track, stream);
        });

        peerConnection.current.ontrack = (event) => {
            remoteVideo.current.srcObject = event.streams[0];
        };

        peerConnection.current.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit("ice-candidate", {
                    roomId: room,
                    candidate: event.candidate,
                });
            }
        };

        socket.emit("join-room", room);

        socket.on("ready", async () => {
            if (host && peerConnection.current.signalingState === "stable") {
                const offer = await peerConnection.current.createOffer();
                await peerConnection.current.setLocalDescription(offer);

                socket.emit("offer", {
                    roomId: room,
                    offer: offer,
                });
            }
        });

        if (peerConnection.current.signalingState !== "stable") return;

        socket.on("offer", async (offer) => {
            await peerConnection.current.setRemoteDescription(offer);
            const answer = await peerConnection.current.createAnswer();
            await peerConnection.current.setLocalDescription(answer);
            socket.emit("answer", { roomId: room, answer });
        });

        socket.on("answer", async (answer) => {
            await peerConnection.current.setRemoteDescription(answer);
        });

        socket.on("ice-candidate", async (candidate) => {
            await peerConnection.current.addIceCandidate(candidate);
        });

        socket.on("call-ended", () => {
            endCall();
        });
    };

    const generateRoomId = () => {
        const part1 = Math.floor(100 + Math.random() * 900);     // 3 digits
        const part2 = Math.floor(1000 + Math.random() * 9000);   // 4 digits
        const part3 = Math.floor(100 + Math.random() * 900);     // 3 digits

        return `${part1}-${part2}-${part3}`;
    };

    const createRoom = async () => {
        const newRoom = generateRoomId();
        setRoomId(newRoom);
        createConnection(newRoom, true);
    };

    const joinRoom = async () => {
        if (!inputRoom) return;
        setRoomId(inputRoom);
        createConnection(inputRoom, false);
    };

    const toggleMute = () => {
        if (!localStream.current) return;

        localStream.current.getAudioTracks().forEach((track) => {
            track.enabled = !track.enabled;
            setIsMuted(!track.enabled);
        });
    };

    const toggleCamera = () => {
        if (!localStream.current) return;

        localStream.current.getVideoTracks().forEach((track) => {
            track.enabled = !track.enabled;
            setIsCameraOff(!track.enabled);
        });
    };

    const endCall = () => {
        // Stop all media tracks
        if (localStream.current) {
            localStream.current.getTracks().forEach((track) => track.stop());
        }

        // Close peer connection
        if (peerConnection.current) {
            peerConnection.current.close();
        }

        // Clear videos
        if (localVideo.current) localVideo.current.srcObject = null;
        if (remoteVideo.current) remoteVideo.current.srcObject = null;

        if (peerConnection.current) {
            peerConnection.current.ontrack = null;
            peerConnection.current.onicecandidate = null;
            peerConnection.current.close();
            peerConnection.current = null;
        }

        socket.emit("leave-room", roomId);

        // Reset state
        setRoomId("");
        setInputRoom("");
        setIsMuted(false);
        setIsCameraOff(false);
        setIsChatOpen(false);
        setMessages([]);

    };

    const copyToClipboard = async () => {
        console.log("Copying room ID:", roomId);
        try {
            await navigator.clipboard.writeText(roomId);
            setCopied(true);

            setTimeout(() => {
                setCopied(false);
            }, 2000);
        } catch (err) {
            console.error("Copy failed:", err);
        }
    };

    const toggleScreenShare = async () => {
        if (!peerConnection.current) return;

        if (!isScreenSharing) {
            try {
                const displayStream = await navigator.mediaDevices.getDisplayMedia({
                    video: true,
                });

                const screenTrack = displayStream.getVideoTracks()[0];

                const sender = peerConnection.current
                    .getSenders()
                    .find((s) => s.track.kind === "video");

                if (sender) {
                    sender.replaceTrack(screenTrack);
                }

                localVideo.current.srcObject = displayStream;
                screenStream.current = displayStream;
                setIsScreenSharing(true);

                // When user clicks "Stop Sharing" from browser popup
                screenTrack.onended = () => {
                    stopScreenShare();
                };

            } catch (err) {
                console.error("Screen share error:", err);
            }
        } else {
            stopScreenShare();
        }
    };

    const stopScreenShare = async () => {
        if (!localStream.current) return;

        const cameraTrack = localStream.current.getVideoTracks()[0];

        const sender = peerConnection.current
            .getSenders()
            .find((s) => s.track.kind === "video");

        if (sender) {
            sender.replaceTrack(cameraTrack);
        }

        localVideo.current.srcObject = localStream.current;

        if (screenStream.current) {
            screenStream.current.getTracks().forEach((track) => track.stop());
        }

        setIsScreenSharing(false);
    };

    const sendMessage = () => {
        if (!chatInput.trim() || !dataChannel.current) return;

        dataChannel.current.send(
            JSON.stringify({
                type: "chat",
                text: chatInput,
            })
        );

        setMessages((prev) => [...prev, { type: "chat", sender: "me", text: chatInput }]);
        setChatInput("");
    };

    const sendFile = async (file) => {
        if (!dataChannel.current) return;

        dataChannel.current.send(
            JSON.stringify({
                type: "file-info",
                name: file.name,
                size: file.size,
            })
        );

        const chunkSize = 16 * 1024;
        let offset = 0;

        while (offset < file.size) {
            const slice = file.slice(offset, offset + chunkSize);
            const buffer = await slice.arrayBuffer();

            dataChannel.current.send(buffer);
            offset += chunkSize;
        }

        // Add file message to sender chat
        setMessages((prev) => [
            ...prev,
            {
                type: "file",
                sender: "me",
                name: file.name,
                size: file.size,
                blob: file,
            },
        ]);
    };

    return (
        <div className={styles.container}>

            {!roomId ? (
                <div className={styles.lobby}>
                    <h2 className={styles.title}>Start a Meeting</h2>

                    <button className={styles.primaryBtn} onClick={createRoom}>
                        Create Room
                    </button>

                    <div className={styles.joinSection}>
                        <input
                            className={styles.input}
                            placeholder="Enter Room ID"
                            value={inputRoom}
                            onChange={(e) => setInputRoom(e.target.value)}
                        />
                        <button className={styles.secondaryBtn} onClick={joinRoom}>
                            Join
                        </button>
                    </div>
                </div>
            ) : (
                <div className={styles.callWrapper}>
                    <div className={styles.meetingBar}>
                        <span className={styles.meetingText}>
                            {roomId}
                        </span>

                        <button
                            onClick={copyToClipboard}
                            className={styles.copyBtn}
                        >
                            {copied ? <Check size={18} /> : <Copy size={18} />}
                        </button>
                    </div>
                    {/* Remote Video Fullscreen */}
                    <video
                        ref={remoteVideo}
                        autoPlay
                        playsInline
                        className={styles.remoteVideo}
                    />

                    {/* Local Small Preview */}
                    <video
                        ref={localVideo}
                        autoPlay
                        playsInline
                        muted
                        className={styles.localVideo}
                    />

                    {/* Bottom Controls */}
                    <div className={styles.controls}>

                        <button
                            onClick={toggleMute}
                            className={`${styles.controlBtn} ${isMuted ? styles.active : ""}`}
                        >
                            {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
                        </button>

                        <button
                            onClick={toggleCamera}
                            className={`${styles.controlBtn} ${isCameraOff ? styles.active : ""}`}
                        >
                            {isCameraOff ? <VideoOff size={22} /> : <Video size={22} />}
                        </button>

                        <button
                            onClick={toggleScreenShare}
                            className={`${styles.controlBtn} ${isScreenSharing ? styles.active : ""}`}
                        >
                            {isScreenSharing ? <MonitorOff size={22} /> : <Monitor size={22} />}
                        </button>

                        <button
                            onClick={() => setIsChatOpen(!isChatOpen)}
                            className={styles.controlBtn}
                        >
                            <MessageCircle size={22} />
                        </button>

                        <button
                            onClick={endCall}
                            className={`${styles.controlBtn} ${styles.endCall}`}
                        >
                            <PhoneOff size={22} />
                        </button>

                    </div>
                </div>
            )}

            {isChatOpen && (
                <div className={styles.chatPanel}>
                    <div className={styles.chatMessages}>
                        {messages.map((msg, index) => (
                            <div
                                key={index}
                                className={
                                    msg.sender === "me"
                                        ? styles.myMessage
                                        : styles.remoteMessage
                                }
                            >
                                {msg.type === "chat" && <span>{msg.text}</span>}

                                {msg.type === "file" && (
                                    <div className={styles.fileMessage}>
                                        <div className={styles.fileHeader}>
                                            <FileIcon size={16} />
                                            <span className={styles.fileName}>{msg.name}</span>
                                        </div>

                                        <div className={styles.fileSize}>
                                            {(msg.size / 1024).toFixed(1)} KB
                                        </div>

                                        <button
                                            className={styles.downloadBtn}
                                            onClick={() => {
                                                const url = URL.createObjectURL(msg.blob);
                                                const a = document.createElement("a");
                                                a.href = url;
                                                a.download = msg.name;
                                                a.click();
                                            }}
                                        >
                                            <Download size={16} />
                                            Download
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    <div className={styles.chatInputArea}>
                        <input
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            placeholder="Type a message..."
                            className={styles.chatInput}
                            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                        />
                        <input
                            type="file"
                            ref={fileInputRef}
                            style={{ display: "none" }}
                            onChange={(e) => {
                                const file = e.target.files[0];
                                if (file) sendFile(file);
                            }}
                        />

                        <button
                            onClick={() => fileInputRef.current.click()}
                            className={styles.sendBtn}
                        >
                            <Paperclip size={18} />
                        </button>
                        <button onClick={sendMessage} className={styles.sendBtn}>
                            <Send size={18} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default VideoCall;