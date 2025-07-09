const localVideo = document.createElement("video");
localVideo.autoplay = true;
localVideo.muted = true;
document.body.appendChild(localVideo);

const remoteVideo = document.createElement("video");
remoteVideo.autoplay = true;
document.body.appendChild(remoteVideo);

const pc = new RTCPeerConnection({
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
});

// ローカルメディア取得
function isAnswerer() {
  return window.location.search.includes("answer");
}

navigator.mediaDevices
  .getUserMedia({ video: true, audio: true })
  .then((stream) => {
    console.log("[getUserMedia] got stream", stream);
    localVideo.srcObject = stream;
    stream.getTracks().forEach((track) => {
      console.log("[getUserMedia] addTrack", track);
      pc.addTrack(track, stream);
    });
    if (!isAnswerer()) {
      start(); // Offererだけstart()を呼ぶ
    }
  })
  .catch((err) => {
    console.error("[getUserMedia] error", err);
  });

// リモートトラック受信
pc.ontrack = (event) => {
  console.log("[ontrack] event", event);
  // 既存のstreamがなければセット
  if (!remoteVideo.srcObject) {
    remoteVideo.srcObject = event.streams[0];
    console.log("[ontrack] set remote stream", event.streams[0]);
  }
  // 既にsrcObjectがある場合も、trackが追加されたら再セット
  else if (remoteVideo.srcObject !== event.streams[0]) {
    remoteVideo.srcObject = event.streams[0];
    console.log("[ontrack] update remote stream", event.streams[0]);
  }
  // 明示的に再生を試みる
  remoteVideo.play().catch((e) => {
    console.warn("[ontrack] play error", e);
  });
};

const baseURL = import.meta.env.VITE_SIGNARING_URL

// シグナリング用の簡易API
async function postSignal(data: { sdp?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit }) {
  console.log("[postSignal] send", data);
  if (!baseURL) {
    console.error("[postSignal] baseURL is not set");
    return;
  }
  const res = await fetch(`${baseURL}/api/signal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  console.log("[postSignal] response", json);
  return json;
}

pc.onicecandidate = async (event) => {
  if (event.candidate) {
    console.log("[onicecandidate] candidate:", event.candidate);
    await postSignal({ candidate: event.candidate.toJSON() });
  } else {
    console.log("[onicecandidate] ICE gathering complete");
  }
};

// start()は常にOffererとして動作
async function start() {
  console.log("[start] createOffer");
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  console.log("[start] setLocalDescription(offer)", offer);
  await postSignal({ sdp: offer });
}

// 定期的にシグナリングサーバからデータを取得
async function pollSignal() {
  setInterval(async () => {
    // Offerer/Answererでポーリング時のリクエスト内容を分岐
    let pollBody = {};
    if (isAnswerer()) {
      pollBody = { role: "answerer" };
    } else {
      pollBody = { role: "offerer" };
    }
    const res = await postSignal(pollBody);
    if (res.sdp) {
      // SDPのtypeごとに分岐し、状態を厳密に管理
      const sdpStr = res.sdp.sdp || "";
      if (!sdpStr.includes("m=")) {
        console.warn("[pollSignal] 受信SDPにm=行がありません。setRemoteDescriptionをスキップします", res.sdp);
        return;
      }
      if (res.sdp.type === "offer" && isAnswerer() && !pc.currentRemoteDescription) {
        // Answererがofferを受け取った場合のみsetRemoteDescription
        console.log("[pollSignal] setRemoteDescription (offer)", res.sdp);
        await pc.setRemoteDescription(new RTCSessionDescription(res.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        console.log("[pollSignal] setLocalDescription(answer)", answer);
        await postSignal({ sdp: answer });
      } else if (res.sdp.type === "answer" && !isAnswerer() && !pc.currentRemoteDescription) {
        // Offererがanswerを受け取った場合のみsetRemoteDescription
        console.log("[pollSignal] setRemoteDescription (answer)", res.sdp);
        await pc.setRemoteDescription(new RTCSessionDescription(res.sdp));
      }
    }
    if (Array.isArray(res.candidates)) {
      for (const c of res.candidates) {
        console.log("[pollSignal] addIceCandidate", c);
        await pc.addIceCandidate(c);
      }
    } else if (res.candidate) {
      console.log("[pollSignal] addIceCandidate", res.candidate);
      await pc.addIceCandidate(res.candidate);
    }
  }, 1000);
}

// スタイル調整
localVideo.style.display = "block";
localVideo.style.width = "80vw";
localVideo.style.maxWidth = "600px";
localVideo.style.margin = "20px auto 0 auto";
localVideo.style.borderRadius = "8px";

remoteVideo.style.display = "block";
remoteVideo.style.width = "80vw";
remoteVideo.style.maxWidth = "600px";
remoteVideo.style.margin = "20px auto 20px auto";
remoteVideo.style.borderRadius = "8px";

pollSignal();
