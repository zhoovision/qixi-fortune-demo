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
const giftPanel = document.querySelector("#giftPanel");
const giftScrim = document.querySelector("#giftScrim");
const giftHotspot = document.querySelector("#giftHotspot");
const panelHandle = document.querySelector("#panelHandle");
const giftCards = [...document.querySelectorAll(".gift-card")];
const sendGift = document.querySelector("#sendGift");
const sendPrice = document.querySelector("#sendPrice");
const balanceValue = document.querySelector("#balanceValue");
const giftToast = document.querySelector("#giftToast");

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
let giftPanelOpen = true;
let giftSent = false;
let balance = 200;
let selectedGift = giftCards[0];
let toastTimer;
let sendRevealTimer;
let fortuneHoldTimer;
let fortuneFadeTimer;

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
    armMotionSensor(true);
  } catch {
    motionFallback = true;
    state = "armed";
    hint.textContent = "未开启动作权限，轻触签筒体验";
    bucket.setAttribute("aria-label", "轻触签筒开始抽签");
  }
}

function armMotionSensor(withFeedback = false) {
  window.removeEventListener("devicemotion", handleMotion);
  window.addEventListener("devicemotion", handleMotion, { passive: true });
  motionEnabled = true;
  motionFallback = false;
  motionSeen = false;
  state = "armed";
  hint.textContent = "摇一摇，请一支缘分签";
  bucket.setAttribute("aria-label", "摇动手机开始抽签");

  if (withFeedback) {
    vibrate(24);
    playTone(440, 0.12, 0.02);
  }

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
}

function autoEnableMotion() {
  if (typeof DeviceMotionEvent === "undefined") {
    motionFallback = true;
    state = "armed";
    hint.textContent = "当前设备不支持摇一摇，轻触签筒体验";
    bucket.setAttribute("aria-label", "轻触签筒开始抽签");
    return;
  }

  if (typeof DeviceMotionEvent.requestPermission === "function") {
    state = "idle";
    hint.textContent = "轻触开启摇一摇";
    bucket.setAttribute("aria-label", "轻触开启手机摇一摇权限");
    return;
  }

  armMotionSensor(false);
}

function handleMotion(event) {
  if (!motionEnabled) return;

  const now = performance.now();
  const acceleration = event.acceleration;
  const gravityAcceleration = event.accelerationIncludingGravity;
  let energy = 0;
  let hasMotionData = false;

  if (acceleration && [acceleration.x, acceleration.y, acceleration.z].every(Number.isFinite)) {
    hasMotionData = true;
    energy = Math.hypot(acceleration.x, acceleration.y, acceleration.z);
  } else if (
    gravityAcceleration &&
    [gravityAcceleration.x, gravityAcceleration.y, gravityAcceleration.z].every(Number.isFinite)
  ) {
    hasMotionData = true;
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

  if (!hasMotionData) return;
  motionSeen = true;
  clearTimeout(motionWatchdog);

  if (state !== "armed" || giftPanelOpen || !giftSent) {
    shakeScore = 0;
    return;
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
  if (state !== "armed" || giftPanelOpen || !giftSent) return;
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
  clearTimeout(fortuneHoldTimer);
  clearTimeout(fortuneFadeTimer);
  state = "revealed";
  dragging = false;
  const fortune = chooseFortune();
  fortuneTitle.textContent = fortune.title;
  fortuneText.textContent = fortune.text;
  drawStick.style.setProperty("--pull", "-170px");
  ritual.classList.add("leaving");
  reveal.classList.remove("fading");
  reveal.classList.add("visible");
  reveal.setAttribute("aria-hidden", "false");
  fortuneSign.setAttribute("tabindex", "0");
  setTimeout(() => fortuneSign.focus({ preventScroll: true }), 650);
  vibrate([50, 60, 90]);
  playTone(760, 0.28, 0.045);
  setTimeout(() => playTone(980, 0.35, 0.03), 120);
  burst(24);

  fortuneHoldTimer = setTimeout(hideFortune, 2930);
}

function hideFortune() {
  if (state !== "revealed") return;
  reveal.classList.add("fading");
  fortuneSign.removeAttribute("tabindex");
  fortuneFadeTimer = setTimeout(() => {
    reveal.classList.remove("visible", "fading");
    reveal.setAttribute("aria-hidden", "true");
    state = "complete";
  }, 520);
}

function reset() {
  clearTimeout(fortuneHoldTimer);
  clearTimeout(fortuneFadeTimer);
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
  reveal.classList.remove("visible", "fading");
  reveal.setAttribute("aria-hidden", "true");
  fortuneSign.removeAttribute("tabindex");
  playTone(440, 0.12, 0.02);
}

function selectGift(card) {
  selectedGift = card;
  giftCards.forEach((item) => {
    const selected = item === card;
    item.classList.toggle("selected", selected);
    item.setAttribute("aria-pressed", String(selected));
  });
  sendPrice.textContent = card.dataset.price;
  vibrate(12);
}

function showGiftToast(message) {
  clearTimeout(toastTimer);
  giftToast.textContent = message;
  giftToast.classList.add("show");
  toastTimer = setTimeout(() => giftToast.classList.remove("show"), 1800);
}

function closeGiftPanel() {
  giftPanelOpen = false;
  phone.classList.remove("gift-panel-open");
  giftPanel.classList.remove("open");
  giftPanel.setAttribute("aria-hidden", "true");
  giftScrim.classList.remove("visible");
}

function openGiftPanel() {
  clearTimeout(sendRevealTimer);
  if (["revealed", "ready", "shaking", "sending", "complete"].includes(state)) reset();
  giftSent = false;
  giftPanelOpen = true;
  sendGift.disabled = false;
  phone.classList.add("gift-panel-open");
  phone.classList.add("gift-not-sent");
  giftPanel.classList.add("open");
  giftPanel.setAttribute("aria-hidden", "false");
  giftScrim.classList.add("visible");
}

async function sendSelectedGift() {
  const { gift, name } = selectedGift.dataset;
  const price = Number(selectedGift.dataset.price);

  if (gift !== "fortune") {
    showGiftToast(`${name}仅作面板占位，请选择心有灵犀签`);
    vibrate([18, 35, 18]);
    return;
  }

  if (balance < price) {
    showGiftToast("钻石余额不足");
    return;
  }

  if (state === "idle") await enableMotion();
  balance -= price;
  balanceValue.textContent = balance;
  giftSent = true;
  state = "sending";
  sendGift.disabled = true;
  phone.classList.remove("gift-not-sent");
  ritual.className = "ritual leaving";
  closeGiftPanel();
  vibrate([24, 28, 48]);
  playTone(680, 0.2, 0.035);

  sendRevealTimer = setTimeout(() => {
    showFortune();
  }, 420);
}

function pointerDown(event) {
  if (!giftSent || giftPanelOpen) return;
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
giftCards.forEach((card) => card.addEventListener("click", () => selectGift(card)));
sendGift.addEventListener("click", sendSelectedGift);
giftScrim.addEventListener("click", () => closeGiftPanel());
panelHandle.addEventListener("click", () => closeGiftPanel());
giftHotspot.addEventListener("click", openGiftPanel);

function returnToGiftPanel() {
  reset();
  giftSent = false;
  openGiftPanel();
}

again.addEventListener("click", returnToGiftPanel);
fortuneSign.addEventListener("click", () => state === "revealed" && returnToGiftPanel());
fortuneSign.addEventListener("keydown", (event) => {
  if (state === "revealed" && (event.key === "Enter" || event.key === " ")) returnToGiftPanel();
});

document.addEventListener("keydown", (event) => {
  if ((event.key === "Enter" || event.key === " ") && state === "idle") enableMotion();
  if ((event.key === "Enter" || event.key === " ") && state === "armed" && motionFallback) startShake();
  if (event.key === "ArrowUp" && state === "ready") showFortune();
  if (event.key === "Escape" && state === "revealed") reset();
});

buildBucketCutout();
autoEnableMotion();
