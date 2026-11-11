// Supabase 연결 (PRD Phase 2 — 실습용)
// 별도 라이브러리 없이 Supabase REST API(PostgREST)를 fetch로 부른다.
// 아래 키는 브라우저에 넣어도 되는 "공개(publishable) 키"다. service_role·secret 키는 절대 넣지 않는다.
// 무엇을 읽고 쓸 수 있는지는 Supabase의 RLS 정책이 정한다.

var CLOUD = (function () {
  var URL_BASE = "https://ntqghsxqywutjcfpgyjl.supabase.co/rest/v1/";
  var KEY = "sb_publishable_8IIIWdesafFrkuCzD5bKZg_-OKKqvoE";

  function req(path, opt) {
    opt = opt || {};
    var headers = { apikey: KEY, "Content-Type": "application/json" };
    if (opt.prefer) headers.Prefer = opt.prefer;
    return fetch(URL_BASE + path, {
      method: opt.method || "GET",
      headers: headers,
      body: opt.body ? JSON.stringify(opt.body) : undefined,
    }).then(function (res) {
      if (!res.ok) return res.text().then(function (t) { throw new Error(res.status + " " + t); });
      return res.status === 204 ? null : res.text().then(function (t) { return t ? JSON.parse(t) : null; });
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

  return {
    // 구성원 + 기록 전체 불러오기
    loadAll: function () {
      return Promise.all([
        req("members?select=*&order=id"),
        req("records?select=*&order=date.asc,id.asc"),
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
      return req("records?select=*", { method: "POST", body: list.map(toRow), prefer: "return=representation" })
        .then(function (rows) { return rows.map(toRecord); });
    },
    deleteRecord: function (id) {
      return req("records?id=eq." + encodeURIComponent(id), { method: "DELETE" });
    },
    // 의견 남기기 게시판 — 숨김 처리(hidden)된 의견은 RLS가 걸러서 내려주지 않는다
    listFeedback: function () {
      return req("feedback?select=id,nickname,category,message,created_at&order=created_at.desc&limit=50");
    },
    addFeedback: function (f) {
      return req("feedback?select=id,nickname,category,message,created_at", { method: "POST", body: f, prefer: "return=representation" })
        .then(function (rows) { return rows[0]; });
    },
    saveGoals: function (memberId, goals) {
      return req("members?id=eq." + encodeURIComponent(memberId), { method: "PATCH",
        body: { goal_exercise: goals.exercise, goal_reading: goals.reading, goal_study: goals.study } });
    },
  };
})();
