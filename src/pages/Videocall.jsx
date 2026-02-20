import React, { useRef, useState, useEffect } from "react";
import { io } from "socket.io-client";
import { v4 as uuidv4 } from "uuid";
import {
    Mic,
    MicOff,
    Video,
    VideoOff,
    PhoneOff,
    Copy,
    Check
} from "lucide-react";

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
            if (host) {
                await peerConnection.current.setLocalDescription(
                    await peerConnection.current.createOffer()
                );

                socket.emit("offer", {
                    roomId: room,
                    offer: peerConnection.current.localDescription,
                });
            }
        });

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

    const createRoom = async () => {
        const newRoom = uuidv4();
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

        socket.emit("leave-room", roomId);

        // Reset state
        setRoomId("");
        setInputRoom("");
        setIsMuted(false);
        setIsCameraOff(false);
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
                            onClick={endCall}
                            className={`${styles.controlBtn} ${styles.endCall}`}
                        >
                            <PhoneOff size={22} />
                        </button>

                    </div>
                </div>
            )}
        </div>
    );
};

export default VideoCall;