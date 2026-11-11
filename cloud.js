// Supabase 연결 (PRD Phase 2 — 실습용)
// supabase-js를 CDN(index.html의 <script>)으로 불러와 쓴다. 빌드 도구 없이 파일만으로 동작.
// 아래 키는 브라우저에 넣어도 되는 "공개(publishable) 키"다. secret·service_role 키는 절대 넣지 않는다.
// 무엇을 읽고 쓸 수 있는지는 Supabase의 RLS 정책과 권한이 정한다.

var CLOUD = (function () {
  var SUPABASE_URL = "https://ntqghsxqywutjcfpgyjl.supabase.co";
  var SUPABASE_KEY = "sb_publishable_8IIIWdesafFrkuCzD5bKZg_-OKKqvoE";

  // 로그인 상태는 supabase-js가 이 브라우저에 저장하고 자동으로 갱신한다
  var db = window.supabase && window.supabase.createClient
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
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
    return { id: r.id, name: r.name, emoji: r.emoji, color: r.color, user: r.user_id || null,
      goals: { exercise: Number(r.goal_exercise), reading: Number(r.goal_reading), study: Number(r.goal_study) } };
  }
  function toRecord(r) {
    return { id: r.id, member: r.member_id, cat: r.category, value: Number(r.value), memo: r.memo || "", date: r.date, user: r.user_id || null };
  }
  function toRow(r) {
    return { member_id: r.member, category: r.cat, value: r.value, memo: (r.memo || "").slice(0, 40), date: r.date };
  }

  var FB_COLS = "id,nickname,category,message,created_at,user_id";

  // Supabase 오류 → 화면에 보여줄 한국어 문구
  function authMsg(err) {
    var m = (err && err.message) || "";
    if (/Invalid login credentials/i.test(m)) return "이메일 또는 비밀번호가 맞지 않아요";
    if (/Email not confirmed/i.test(m)) return "메일함의 확인 링크를 먼저 눌러 주세요";
    if (/already registered|already been registered/i.test(m)) return "이미 가입된 이메일이에요. 로그인해 주세요";
    if (/Password should be at least/i.test(m)) return "비밀번호는 6자 이상으로 정해 주세요";
    if (/email rate limit/i.test(m)) return "확인 메일 발송 한도를 넘었어요(무료 메일은 1시간에 몇 통만 보낼 수 있어요). 1시간쯤 뒤 다시 시도해 주세요";
    if (/Email address .* is invalid/i.test(m)) return "이 이메일 주소로는 가입할 수 없어요. 실제로 메일을 받을 수 있는 주소를 써 주세요";
    if (/valid email|invalid format|Unable to validate email/i.test(m)) return "이메일 주소를 확인해 주세요";
    if (/rate limit|security purposes/i.test(m)) return "잠시 뒤 다시 시도해 주세요(요청이 너무 잦아요)";
    if (/signups not allowed|Signups not allowed/i.test(m)) return "지금은 회원가입을 받지 않아요";
    return "처리하지 못했어요. 인터넷 연결을 확인해 주세요";
  }
  function authRun(fn) {
    if (!db) return Promise.reject(new Error("supabase-js를 불러오지 못했어요"));
    return fn(db.auth).then(function (res) {
      if (res.error) { var e = new Error(authMsg(res.error)); e.raw = res.error; throw e; }
      return res.data;
    });
  }

  return {
    // ----- 로그인 (이메일·비밀번호) -----
    // 로그인 상태가 바뀔 때마다(시작 시 포함) cb(user 또는 null) 호출
    onAuth: function (cb) {
      if (!db) { cb(null); return; }
      db.auth.onAuthStateChange(function (_event, session) {
        // supabase-js 권장: 콜백 안에서 바로 다른 Supabase 호출을 하지 않도록 다음 차례로 미룸
        setTimeout(function () { cb(session ? session.user : null); }, 0);
      });
    },
    signUp: function (email, password) {
      // 확인 메일의 링크를 누르면 지금 보고 있는 사이트 주소로 돌아온다
      var back = location.origin + location.pathname;
      return authRun(function (a) { return a.signUp({ email: email, password: password, options: { emailRedirectTo: back } }); })
        .then(function (d) { return { needConfirm: !d.session }; });
    },
    signIn: function (email, password) {
      return authRun(function (a) { return a.signInWithPassword({ email: email, password: password }); });
    },
    signOut: function () {
      return authRun(function (a) { return a.signOut(); });
    },
    // 아직 주인이 없는 구성원을 "나"로 연결
    claimMember: function (memberId, userId) {
      return run(function (d) {
        return d.from("members").update({ user_id: userId }).eq("id", memberId).is("user_id", null).select("id");
      }).then(function (rows) { if (!rows.length) throw new Error("이미 다른 사람이 연결한 구성원이에요"); });
    },
    deleteFeedback: function (id) {
      return run(function (d) { return d.from("feedback").delete().eq("id", id).select("id"); })
        .then(function (rows) { if (!rows.length) throw new Error("본인 글만 삭제할 수 있어요"); });
    },

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
      // RLS가 남의 기록을 걸러내면 오류 없이 0건이 지워지므로, 지워진 건수로 확인
      return run(function (d) { return d.from("records").delete().eq("id", id).select("id"); })
        .then(function (rows) { if (!rows.length) throw new Error("본인이 남긴 기록만 삭제할 수 있어요"); });
    },
    saveGoals: function (memberId, goals) {
      return run(function (d) {
        return d.from("members")
          .update({ goal_exercise: goals.exercise, goal_reading: goals.reading, goal_study: goals.study })
          .eq("id", memberId).select("id");
      }).then(function (rows) { if (!rows.length) throw new Error("내 구성원의 목표만 고칠 수 있어요"); });
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
