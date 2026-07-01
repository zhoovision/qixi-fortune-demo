const phone = document.querySelector("#phone");
const ritual = document.querySelector("#ritual");
const bucket = document.querySelector("#bucket");
const drawStick = document.querySelector("#drawStick");
const hint = document.querySelector("#hint");
const reveal = document.querySelector("#reveal");
const fortuneSign = document.querySelector("#fortuneSign");
const fortuneTitle = document.querySelector("#fortuneTitle");
const fortuneText = document.querySelector("#fortuneText");
const again = document.querySelector("#again");
const sparkles = document.querySelector("#sparkles");

const fortunes = [
  { title: "心有灵犀签", text: "所念之人，正携月色向你而来。" },
  { title: "双向奔赴签", text: "你迈出的每一步，都会被温柔接住。" },
  { title: "今日偏爱签", text: "今晚的好运，会先轻轻叫你的名字。" },
  { title: "鹊桥加速签", text: "想见的人，正在穿过人海向你靠近。" },
  { title: "月光撑腰签", text: "放心去喜欢，今夜月亮替你保密。" },
  { title: "心动回声签", text: "你发出的真心，终会收到温柔回应。" },
  { title: "甜度超标签", text: "今日不宜嘴硬，宜大方收下偏爱。" },
  { title: "桃花如约签", text: "好缘分没有迟到，只在挑最好的时辰。" },
  { title: "月老催单签", text: "别把心意藏太久，有人正等你开口。" },
];

let state = "idle";
let pointerStartY = 0;
let dragging = false;
let lastFortune = -1;
let audioContext;
let motionEnabled = false;
let motionFallback = false;
let lastMotion = null;
let shakeScore = 0;
let lastMotionAt = 0;
let motionSeen = false;
let motionWatchdog;

function buildBucketCutout() {
  const image = new Image();
  image.src = "assets/fortune-bucket.png";
  image.onload = () => {
    bucket.width = image.naturalWidth;
    bucket.height = image.naturalHeight;
    const context = bucket.getContext("2d", { willReadFrequently: true });
    context.drawImage(image, 0, 0);
    const frame = context.getImageData(0, 0, bucket.width, bucket.height);
    const pixels = frame.data;

    for (let i = 0; i < pixels.length; i += 4) {
      const luminance = 0.2126 * pixels[i] + 0.7152 * pixels[i + 1] + 0.0722 * pixels[i + 2];
      const maxChannel = Math.max(pixels[i], pixels[i + 1], pixels[i + 2]);
      const minChannel = Math.min(pixels[i], pixels[i + 1], pixels[i + 2]);
      const saturation = maxChannel - minChannel;

      if (luminance < 9 && saturation < 8) {
        pixels[i + 3] = 0;
      } else if (luminance < 34 && saturation < 18) {
        pixels[i + 3] = Math.round(((luminance - 9) / 25) * 255);
      }
    }

    context.putImageData(frame, 0, 0);
  };
}

function vibrate(pattern) {
  if (navigator.vibrate) navigator.vibrate(pattern);
}

function playTone(frequency = 520, duration = 0.12, volume = 0.035) {
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
    gain.gain.setValueAtTime(volume, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + duration);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + duration);
  } catch {
    // Audio is an enhancement; interaction still works when autoplay policies block it.
  }
}

function burst(count = 16) {
  for (let i = 0; i < count; i += 1) {
    const spark = document.createElement("span");
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.3;
    const distance = 55 + Math.random() * 90;
    spark.className = "spark";
    spark.style.setProperty("--x", `${Math.cos(angle) * distance}px`);
    spark.style.setProperty("--y", `${Math.sin(angle) * distance}px`);
    spark.style.animationDelay = `${Math.random() * 140}ms`;
    sparkles.append(spark);
    spark.addEventListener("animationend", () => spark.remove(), { once: true });
  }
}

function chooseFortune() {
  let next = Math.floor(Math.random() * fortunes.length);
  if (fortunes.length > 1 && next === lastFortune) next = (next + 1) % fortunes.length;
  lastFortune = next;
  return fortunes[next];
}

async function enableMotion() {
  if (state !== "idle") return;

  if (typeof DeviceMotionEvent === "undefined") {
    motionFallback = true;
    state = "armed";
    hint.textContent = "当前设备不支持摇一摇，轻触签筒体验";
    bucket.setAttribute("aria-label", "轻触签筒开始抽签");
    return;
  }

  try {
    if (typeof DeviceMotionEvent.requestPermission === "function") {
      const permission = await DeviceMotionEvent.requestPermission();
      if (permission !== "granted") throw new Error("motion permission denied");
    }

    window.addEventListener("devicemotion", handleMotion, { passive: true });
    motionEnabled = true;
    motionSeen = false;
    state = "armed";
    hint.textContent = "握紧手机，轻轻摇一摇";
    bucket.setAttribute("aria-label", "摇动手机开始抽签");
    vibrate(24);
    playTone(440, 0.12, 0.02);
    clearTimeout(motionWatchdog);
    motionWatchdog = setTimeout(() => {
      if (state === "armed" && !motionSeen) {
        window.removeEventListener("devicemotion", handleMotion);
        motionEnabled = false;
        motionFallback = true;
        hint.textContent = "当前页面无法读取动作，轻触签筒体验";
        bucket.setAttribute("aria-label", "轻触签筒开始抽签");
      }
    }, 2200);
  } catch {
    motionFallback = true;
    state = "armed";
    hint.textContent = "未开启动作权限，轻触签筒体验";
    bucket.setAttribute("aria-label", "轻触签筒开始抽签");
  }
}

function handleMotion(event) {
  if (state !== "armed" || !motionEnabled) return;
  motionSeen = true;
  clearTimeout(motionWatchdog);

  const now = performance.now();
  const acceleration = event.acceleration;
  const gravityAcceleration = event.accelerationIncludingGravity;
  let energy = 0;

  if (acceleration && [acceleration.x, acceleration.y, acceleration.z].every(Number.isFinite)) {
    energy = Math.hypot(acceleration.x, acceleration.y, acceleration.z);
  } else if (
    gravityAcceleration &&
    [gravityAcceleration.x, gravityAcceleration.y, gravityAcceleration.z].every(Number.isFinite)
  ) {
    const current = {
      x: gravityAcceleration.x,
      y: gravityAcceleration.y,
      z: gravityAcceleration.z,
    };
    if (lastMotion) {
      energy = Math.hypot(
        current.x - lastMotion.x,
        current.y - lastMotion.y,
        current.z - lastMotion.z,
      );
    }
    lastMotion = current;
  }

  const elapsed = Math.max(16, now - lastMotionAt);
  lastMotionAt = now;
  shakeScore = Math.max(0, shakeScore - elapsed * 0.018);
  if (energy > 8.5) shakeScore += Math.min(energy, 24);

  if (shakeScore > 24) {
    shakeScore = 0;
    lastMotion = null;
    startShake();
  }
}

function startShake() {
  if (state !== "armed") return;
  state = "shaking";
  ritual.className = "ritual shaking";
  hint.textContent = "红线已动，缘分正在回应";
  vibrate([34, 42, 34, 42, 54]);
  playTone(280, 0.18, 0.02);

  setTimeout(() => {
    state = "ready";
    ritual.className = "ritual ready";
    hint.textContent = "按住发光的签，向上抽出";
    drawStick.setAttribute("aria-hidden", "false");
    vibrate(45);
    playTone(660, 0.18, 0.035);
    burst(12);
  }, 1380);
}

function showFortune() {
  if (state === "revealed") return;
  state = "revealed";
  dragging = false;
  const fortune = chooseFortune();
  fortuneTitle.textContent = fortune.title;
  fortuneText.textContent = fortune.text;
  drawStick.style.setProperty("--pull", "-170px");
  ritual.classList.add("leaving");
  reveal.classList.add("visible");
  reveal.setAttribute("aria-hidden", "false");
  fortuneSign.setAttribute("tabindex", "-1");
  setTimeout(() => fortuneSign.focus({ preventScroll: true }), 650);
  vibrate([50, 60, 90]);
  playTone(760, 0.28, 0.045);
  setTimeout(() => playTone(980, 0.35, 0.03), 120);
  burst(24);
}

function reset() {
  state = motionEnabled || motionFallback ? "armed" : "idle";
  dragging = false;
  ritual.className = "ritual";
  drawStick.style.setProperty("--pull", "0px");
  drawStick.setAttribute("aria-hidden", "true");
  hint.textContent = motionEnabled
    ? "再摇一次，请下一支缘分签"
    : motionFallback
      ? "轻触签筒，再抽一支签"
      : "轻触开启摇一摇";
  reveal.classList.remove("visible");
  reveal.setAttribute("aria-hidden", "true");
  fortuneSign.removeAttribute("tabindex");
  playTone(440, 0.12, 0.02);
}

function pointerDown(event) {
  if (state === "idle") {
    enableMotion();
    return;
  }
  if (state === "armed" && motionFallback) {
    startShake();
    return;
  }
  if (state !== "ready") return;
  dragging = true;
  pointerStartY = event.clientY;
  event.currentTarget.setPointerCapture?.(event.pointerId);
  vibrate(18);
}

function pointerMove(event) {
  if (!dragging || state !== "ready") return;
  const delta = Math.min(0, event.clientY - pointerStartY);
  const pull = Math.max(-180, delta);
  drawStick.style.setProperty("--pull", `${pull}px`);
  if (pull < -105) showFortune();
}

function pointerUp() {
  if (!dragging || state !== "ready") return;
  dragging = false;
  drawStick.style.setProperty("--pull", "0px");
}

bucket.addEventListener("pointerdown", pointerDown);
drawStick.addEventListener("pointerdown", pointerDown);
phone.addEventListener("pointermove", pointerMove);
phone.addEventListener("pointerup", pointerUp);
phone.addEventListener("pointercancel", pointerUp);
again.addEventListener("click", reset);
fortuneSign.addEventListener("click", () => state === "revealed" && reset());

document.addEventListener("keydown", (event) => {
  if ((event.key === "Enter" || event.key === " ") && state === "idle") enableMotion();
  if ((event.key === "Enter" || event.key === " ") && state === "armed" && motionFallback) startShake();
  if (event.key === "ArrowUp" && state === "ready") showFortune();
  if (event.key === "Escape" && state === "revealed") reset();
});

buildBucketCutout();
