// Supabase 연결 (PRD Phase 2 — 실습용)
// supabase-js를 CDN(index.html의 <script>)으로 불러와 쓴다. 빌드 도구 없이 파일만으로 동작.
// 아래 키는 브라우저에 넣어도 되는 "공개(publishable) 키"다. secret·service_role 키는 절대 넣지 않는다.
// 무엇을 읽고 쓸 수 있는지는 Supabase의 RLS 정책과 권한이 정한다.

var CLOUD = (function () {
  var SUPABASE_URL = "https://ntqghsxqywutjcfpgyjl.supabase.co";
  var SUPABASE_KEY = "sb_publishable_8IIIWdesafFrkuCzD5bKZg_-OKKqvoE";

  // 로그인 기능이 아직 없으므로 세션 저장·자동 갱신은 끈다
  var db = window.supabase && window.supabase.createClient
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
    : null;

  // supabase-js 결과 { data, error } → 성공이면 data, 실패면 오류로 넘김
  function run(build) {
    if (!db) return Promise.reject(new Error("supabase-js를 불러오지 못했어요(인터넷 연결 확인)"));
    return Promise.resolve(build(db)).then(function (res) {
      if (res.error) throw res.error;
      return res.data;
    });
  }

  // DB 행 → 앱에서 쓰는 모양
  function toMember(r) {
    return { id: r.id, name: r.name, emoji: r.emoji, color: r.color,
      goals: { exercise: Number(r.goal_exercise), reading: Number(r.goal_reading), study: Number(r.goal_study) } };
  }
  function toRecord(r) {
    return { id: r.id, member: r.member_id, cat: r.category, value: Number(r.value), memo: r.memo || "", date: r.date };
  }
  function toRow(r) {
    return { member_id: r.member, category: r.cat, value: r.value, memo: (r.memo || "").slice(0, 40), date: r.date };
  }

  var FB_COLS = "id,nickname,category,message,created_at";

  return {
    // 구성원 + 기록 전체 불러오기
    loadAll: function () {
      return Promise.all([
        run(function (d) { return d.from("members").select("*").order("id"); }),
        run(function (d) { return d.from("records").select("*").order("date").order("id"); }),
      ]).then(function (res) {
        // 구성원 순서는 data.js 순서(아빠·엄마·…)를 따른다
        var order = SAMPLE_DATA.members.map(function (m) { return m.id; });
        var members = res[0].map(toMember).sort(function (a, b) {
          var ia = order.indexOf(a.id), ib = order.indexOf(b.id);
          return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
        });
        return { members: members, records: res[1].map(toRecord) };
      });
    },
    // 기록 추가 (여러 건 가능) → 저장된 기록(id 포함)을 돌려줌
    addRecords: function (list) {
      return run(function (d) { return d.from("records").insert(list.map(toRow)).select(); })
        .then(function (rows) { return rows.map(toRecord); });
    },
    deleteRecord: function (id) {
      return run(function (d) { return d.from("records").delete().eq("id", id); });
    },
    saveGoals: function (memberId, goals) {
      return run(function (d) {
        return d.from("members")
          .update({ goal_exercise: goals.exercise, goal_reading: goals.reading, goal_study: goals.study })
          .eq("id", memberId);
      });
    },
    // 의견 남기기 게시판 — 숨김 처리(hidden)된 의견은 RLS가 걸러서 내려주지 않는다
    listFeedback: function () {
      return run(function (d) {
        return d.from("feedback").select(FB_COLS).order("created_at", { ascending: false }).limit(50);
      });
    },
    addFeedback: function (f) {
      return run(function (d) {
        return d.from("feedback")
          .insert({ nickname: f.nickname, category: f.category, message: f.message })
          .select(FB_COLS).single();
      });
    },
  };
})();
