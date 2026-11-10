// ★ 다음 단계에서 이 파일만 고치면 내용이 바뀝니다. (예시 데이터)
// 저장된 기록이 있으면 브라우저 저장본이 우선합니다. 바꾼 뒤에는 [순위·공유] 탭의 "예시로 초기화"를 누르세요.

// n일 전 날짜 (YYYY-MM-DD) — 예시 기록이 항상 이번 주 근처에 오도록
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const p = (x) => String(x).padStart(2, "0");
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
}

const CATEGORIES = [
  { key: "exercise", label: "운동", icon: "🏃", unit: "회", step: 1 },
  { key: "reading", label: "독서", icon: "📚", unit: "시간", step: 0.5 },
  { key: "study", label: "공부", icon: "✏️", unit: "시간", step: 0.5 },
];

const SAMPLE_DATA = {
  members: [
    { id: "dad", name: "아빠", emoji: "👨", color: "#3b82f6", goals: { exercise: 3, reading: 2, study: 3 } },
    { id: "mom", name: "엄마", emoji: "👩", color: "#ec4899", goals: { exercise: 4, reading: 3, study: 2 } },
    { id: "son", name: "넘버원", emoji: "🧒", color: "#10b981", goals: { exercise: 3, reading: 4, study: 6 } },
    { id: "daughter", name: "팔방미인", emoji: "👧", color: "#f59e0b", goals: { exercise: 4, reading: 3, study: 4 } },
  ],
  records: [
    { member: "dad", cat: "exercise", value: 1, memo: "아침 조깅 30분", date: daysAgo(0) },
    { member: "dad", cat: "exercise", value: 1, memo: "헬스장", date: daysAgo(1) },
    { member: "dad", cat: "reading", value: 1, memo: "경제 서적", date: daysAgo(1) },
    { member: "mom", cat: "exercise", value: 1, memo: "요가", date: daysAgo(0) },
    { member: "mom", cat: "exercise", value: 1, memo: "동네 산책", date: daysAgo(1) },
    { member: "mom", cat: "reading", value: 1.5, memo: "소설책", date: daysAgo(0) },
    { member: "mom", cat: "study", value: 1, memo: "영어 회화", date: daysAgo(1) },
    { member: "son", cat: "exercise", value: 1, memo: "농구", date: daysAgo(0) },
    { member: "son", cat: "reading", value: 1, memo: "과학 만화", date: daysAgo(0) },
    { member: "son", cat: "study", value: 2, memo: "수학 문제집", date: daysAgo(0) },
    { member: "son", cat: "study", value: 1.5, memo: "영어 단어", date: daysAgo(1) },
    { member: "daughter", cat: "exercise", value: 1, memo: "줄넘기", date: daysAgo(1) },
    { member: "daughter", cat: "reading", value: 2, memo: "동화책 3권", date: daysAgo(0) },
    { member: "daughter", cat: "study", value: 1, memo: "받아쓰기", date: daysAgo(0) },
    { member: "dad", cat: "study", value: 1, memo: "자격증 공부", date: daysAgo(9) },
  ],
  cheers: [
    "이번 주도 다 같이 파이팅! 💪",
    "작은 기록이 모여 큰 변화가 돼요 🌱",
    "서로 응원하면 더 멀리 가요 🎉",
  ],
};
