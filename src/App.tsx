import { useEffect, useRef } from "react";

const WS_URL = "ws://localhost:8014";

export function App() {
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const pcsRef = useRef<RTCPeerConnection | null>(null);

  const createPC = (ws: WebSocket) => {
    const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
    pcsRef.current = pc;

    localStreamRef.current?.getTracks().forEach((track) => {
      pc.addTrack(track, localStreamRef.current!);
    });

    pc.ontrack = (e) => {
      if (remoteVideoRef.current)
        remoteVideoRef.current.srcObject = e.streams[0];
    };

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        ws.send(JSON.stringify({ type: "ice", candidate: e.candidate }));
      }
    };

    return pc;
  };

  const joinCall = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    localStreamRef.current = stream;
    if (localVideoRef.current) localVideoRef.current.srcObject = stream;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    const pc = createPC(ws);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    ws.send(JSON.stringify({ type: "offer", offer }));

    ws.onmessage = async (event) => {
      const msg = JSON.parse(event.data);
      
      if (msg.type === "offer") {
        console.log("offer received");
        const pc = createPC(ws);
        await pc.setRemoteDescription(msg.offer);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        ws.send(JSON.stringify({ type: "answer", answer }));
      }

      if (msg.type === "answer") {
        const pc = pcsRef.current;
        await pc?.setRemoteDescription(msg.answer);
      }

      if (msg.type === "ice") {
        const pc = pcsRef.current;
        await pc?.addIceCandidate(msg.candidate);
      }

      if (msg.type === "peer-left") {
        pcsRef.current?.close();
        pcsRef.current = null;
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
      }
    };
  };

  const leaveCall = () => {
    pcsRef.current?.close();
    pcsRef.current = null;
    wsRef.current?.close();
    wsRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
  };

  useEffect(() => () => leaveCall(), []);

  return (
    <div>
      <button onClick={joinCall}>
        Войти в конференцию
      </button>
      <button onClick={leaveCall}>
        Выйти
      </button>
      <div>
        <p>Вы</p>
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          style={{ width: "100%", background: "#000" }}
        />
      </div>
      <div>
        <p>Собеседник</p>
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          style={{ width: "100%", background: "#000" }}
        />
      </div>
    </div>
  );
}
export default App;
