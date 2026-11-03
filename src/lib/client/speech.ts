'use client';

/**
 * 영어 발음 재생
 *  - text: 기기 내장 speechSynthesis(영어 음성) 우선 → 없으면 /api/tts?text= → 그것도 실패하면 기기 기본 음성으로 한 번 더
 *  - itemId: 시험 중 철자 문항. 정답 철자를 브라우저에 보내지 않기 위해 서버가 문항 id 로 음성을 합성 (기기 음성 대체 불가)
 */
let currentAudio: HTMLAudioElement | null = null;

const hasSynth = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

// 일부 브라우저(안드로이드 Chrome 등)는 voices 를 비동기로 채운다 → 바뀔 때마다 최신 목록을 보관
let voices: SpeechSynthesisVoice[] = [];
if (hasSynth()) {
  const load = () => {
    voices = window.speechSynthesis.getVoices();
  };
  load();
  window.speechSynthesis.addEventListener?.('voiceschanged', load);
}

function pickEnglishVoice(): SpeechSynthesisVoice | null {
  if (!hasSynth()) return null;
  if (voices.length === 0) voices = window.speechSynthesis.getVoices();
  return (
    voices.find((v) => v.lang === 'en-US' && /samantha|google|natural|aria|jenny/i.test(v.name)) ??
    voices.find((v) => v.lang === 'en-US') ??
    voices.find((v) => v.lang.startsWith('en')) ??
    null
  );
}

function stopAll() {
  if (hasSynth()) window.speechSynthesis.cancel();
  currentAudio?.pause();
  currentAudio = null;
}

async function playUrl(url: string): Promise<void> {
  stopAll();
  const audio = new Audio(url);
  currentAudio = audio;
  await audio.play();
}

function speakDevice(text: string, rate: number, voice: SpeechSynthesisVoice | null) {
  stopAll();
  const u = new SpeechSynthesisUtterance(text);
  if (voice) u.voice = voice;
  u.lang = voice?.lang ?? 'en-US';
  u.rate = rate;
  window.speechSynthesis.speak(u);
}

export async function speakText(text: string, rate = 0.85): Promise<void> {
  const voice = pickEnglishVoice();
  if (voice) return speakDevice(text, rate, voice);
  try {
    await playUrl(`/api/tts?text=${encodeURIComponent(text)}`);
  } catch (e) {
    // 서버 음성 실패(설정 오류·한도 등) → 영어 음성이 목록에 없어도 기기 기본 음성에 en-US 로 맡겨 본다
    if (!hasSynth()) throw e;
    speakDevice(text, rate, null);
  }
}

export async function speakItem(itemId: string): Promise<void> {
  await playUrl(`/api/tts?item=${encodeURIComponent(itemId)}`);
}
