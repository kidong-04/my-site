(function () {
  "use strict";
  var KEY = "familyTracker.v1";
  var state = load();
  var pick = { member: state.members[0].id, cat: "exercise" };

  // ---------- 저장 / 불러오기 ----------
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) { var s = JSON.parse(raw); if (s && s.members && s.records) return syncProfiles(s); }
    } catch (e) {}
    return clone(SAMPLE_DATA);
  }
  // data.js에서 호칭·이모지·색을 바꾸면 저장된 데이터에도 반영 (기록·목표는 그대로 유지)
  function syncProfiles(s) {
    s.members.forEach(function (m) {
      var src = SAMPLE_DATA.members.filter(function (x) { return x.id === m.id; })[0];
      if (src) { m.name = src.name; m.emoji = src.emoji; m.color = src.color; }
    });
    return s;
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); }
    catch (e) { toast("이 브라우저에서는 저장이 안 돼요"); }
  }

  // ---------- 날짜 / 주간 ----------
  function pad(n) { return String(n).padStart(2, "0"); }
  function iso(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  // offset: 0 = 이번 주, -1 = 지난주 ...
  function weekRange(offset) {
    var now = new Date();
    var mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7) + (offset || 0) * 7);
    var sun = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6);
    return { start: iso(mon), end: iso(sun), mon: mon, sun: sun };
  }
  function inWeek(date, w) { w = w || weekRange(); return date >= w.start && date <= w.end; }
  function md(d) { return (d.getMonth() + 1) + "/" + d.getDate(); }
  function cat(key) { return CATEGORIES.filter(function (c) { return c.key === key; })[0]; }
  function member(id) { return state.members.filter(function (m) { return m.id === id; })[0]; }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function fmt(n) { return (Math.round(n * 10) / 10).toString(); }

  // ---------- 계산 ----------
  function stats(w) {
    w = w || weekRange();
    return state.members.map(function (m) {
      var per = CATEGORIES.map(function (c) {
        var sum = state.records.reduce(function (a, r) {
          return r.member === m.id && r.cat === c.key && inWeek(r.date, w) ? a + Number(r.value) : a;
        }, 0);
        var goal = Number(m.goals[c.key]) || 0;
        var pct = goal > 0 ? Math.min(sum / goal, 1) : 0;
        return { cat: c, sum: sum, goal: goal, pct: pct };
      });
      var active = per.filter(function (p) { return p.goal > 0; });
      var avg = active.length ? active.reduce(function (a, p) { return a + p.pct; }, 0) / active.length : 0;
      return { m: m, per: per, pct: avg };
    });
  }

  // ---------- 렌더링 ----------
  function render() {
    var w = weekRange(), st = stats();
    document.getElementById("weekLabel").textContent =
      (w.mon.getMonth() + 1) + "/" + w.mon.getDate() + " ~ " + (w.sun.getMonth() + 1) + "/" + w.sun.getDate() + " 이번 주";
    renderHome(st); renderLog(); renderRank(st); renderStats();
  }

  // ---------- 통계 ----------
  var statWeek = 0;
  function famPct(st) { return st.reduce(function (a, s) { return a + s.pct; }, 0) / (st.length || 1); }
  function weekLabel(off) { return off === 0 ? "이번 주" : off === -1 ? "지난주" : (-off) + "주 전"; }

  function streak(id) {
    var days = {};
    state.records.forEach(function (r) { if (r.member === id) days[r.date] = 1; });
    var d = new Date(), n = 0;
    if (!days[iso(d)]) d.setDate(d.getDate() - 1); // 오늘 아직 안 했으면 어제부터 셈
    while (days[iso(d)]) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }

  function renderStats() {
    var w = weekRange(statWeek), st = stats(w);
    document.getElementById("wkTitle").textContent = weekLabel(statWeek);
    document.getElementById("wkRange").textContent = md(w.mon) + " ~ " + md(w.sun);
    document.getElementById("wkNext").disabled = statWeek >= 0;
    document.getElementById("wkFam").textContent = Math.round(famPct(st) * 100) + "%";
    document.getElementById("wkCount").textContent =
      state.records.filter(function (r) { return inWeek(r.date, w); }).length + "건";
    var top = ranked(st)[0];
    document.getElementById("wkMvp").textContent = top && top.pct > 0 ? top.m.emoji + " " + top.m.name : "—";

    document.getElementById("wkMembers").innerHTML = ranked(st).map(function (s) {
      return '<li style="--c:' + s.m.color + '"><span class="avatar sm">' + s.m.emoji + '</span><div class="grow"><b>' + esc(s.m.name) +
        "</b><small>" + s.per.map(function (p) { return p.cat.icon + " " + fmt(p.sum) + "/" + fmt(p.goal) + p.cat.unit; }).join(" · ") +
        '</small></div><span class="wk-pct">' + Math.round(s.pct * 100) + "%</span></li>";
    }).join("");

    var cols = [];
    for (var off = -7; off <= 0; off++) {
      var ww = weekRange(off), p = Math.round(famPct(stats(ww)) * 100);
      cols.push('<button type="button" class="t-col' + (off === statWeek ? " on" : "") + '" data-week="' + off + '" aria-label="' +
        md(ww.mon) + " 주 " + p + '%"><span class="t-val">' + p + '%</span><span class="t-bar"><i style="height:' + Math.max(p, 2) +
        '%"></i></span><span class="t-lab">' + (off === 0 ? "이번 주" : md(ww.mon)) + "</span></button>");
    }
    document.getElementById("trend").innerHTML = cols.join("");

    var sk = state.members.map(function (m) { return { m: m, n: streak(m.id) }; }).sort(function (a, b) { return b.n - a.n; });
    document.getElementById("streakList").innerHTML = sk.map(function (x) {
      return '<li style="--c:' + x.m.color + '"><span class="avatar sm">' + x.m.emoji + '</span><div class="grow"><b>' + esc(x.m.name) +
        "</b><small>" + (x.n > 0 ? "하루도 안 빠지고 기록 중!" : "오늘 기록하면 연속 1일 시작") + '</small></div><span class="streak' +
        (x.n >= 3 ? " hot" : "") + '">' + (x.n > 0 ? "🔥 " : "") + x.n + "일</span></li>";
    }).join("");

    var head = '<div class="tt-row tt-head"><span></span>' + CATEGORIES.map(function (c) { return "<span>" + c.icon + " " + c.label + "</span>"; }).join("") + "</div>";
    var body = state.members.map(function (m) {
      return '<div class="tt-row"><span class="tt-name">' + m.emoji + " " + esc(m.name) + "</span>" + CATEGORIES.map(function (c) {
        var sum = state.records.reduce(function (a, r) { return r.member === m.id && r.cat === c.key ? a + Number(r.value) : a; }, 0);
        return "<span><b>" + fmt(sum) + "</b><small>" + c.unit + "</small></span>";
      }).join("") + "</div>";
    }).join("");
    document.getElementById("totals").innerHTML = head + body;
  }

  document.getElementById("tab-stats").addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b) return;
    if (b.id === "wkPrev") statWeek--;
    else if (b.id === "wkNext" && statWeek < 0) statWeek++;
    else if (b.dataset.week !== undefined) statWeek = Number(b.dataset.week);
    else return;
    renderStats();
  });

  // 도장 칸: 목표 1단위 = 1칸, 0.5 이상 채우면 반 도장
  var lastAdd = null;
  function slots(p, fresh) {
    var n = Math.ceil(p.goal), html = "", lastFilled = -1;
    for (var i = 0; i < n; i++) {
      var f = Math.min(Math.max(p.sum - i, 0), 1);
      var cls = f >= 1 ? "full" : f >= 0.5 ? "half" : "";
      if (cls) lastFilled = i;
      html += '<i class="slot ' + cls + '"></i>';
    }
    if (fresh && lastFilled >= 0) {
      var k = 0;
      html = html.replace(/<i class="slot /g, function (m) { return k++ === lastFilled ? '<i class="slot fresh ' : m; });
    }
    var extra = p.sum - p.goal;
    if (n && extra > 0) html += '<span class="extra">+' + fmt(extra) + "</span>";
    return html;
  }
  function stampTotals(st) {
    var got = 0, all = 0;
    st.forEach(function (s) { s.per.forEach(function (p) {
      var n = Math.ceil(p.goal); all += n;
      got += Math.min(Math.floor(p.sum * 2) / 2, n);
    }); });
    return { got: got, all: all };
  }

  function renderHome(st) {
    var fam = st.reduce(function (a, s) { return a + s.pct; }, 0) / (st.length || 1);
    document.getElementById("familyPct").textContent = Math.round(fam * 100) + "%";
    var tt = stampTotals(st);
    document.getElementById("stampCount").textContent = "도장 " + fmt(tt.got) + " / " + tt.all + "칸";
    var top = st.slice().sort(function (a, b) { return b.pct - a.pct; })[0];
    document.getElementById("mvpBox").innerHTML = '<span class="mvp-tag">이번 주 MVP</span>' + (top && top.pct > 0
      ? "<b>" + top.m.emoji + " <mark>" + esc(top.m.name) + "</mark></b>"
      : "<b>아직 없어요</b>");
    var cheers = state.cheers && state.cheers.length ? state.cheers : SAMPLE_DATA.cheers;
    document.getElementById("cheer").textContent = cheers[new Date().getDate() % cheers.length];

    document.getElementById("memberCards").innerHTML = st.map(function (s) {
      var rows = s.per.map(function (p) {
        var fresh = lastAdd && lastAdd.member === s.m.id && lastAdd.cat === p.cat.key;
        return '<div class="srow' + (p.goal > 0 && p.sum >= p.goal ? " met" : "") + '" aria-label="' + p.cat.label + " " +
          fmt(p.sum) + "/" + fmt(p.goal) + p.cat.unit + '"><span class="s-lab">' + p.cat.icon + " " + p.cat.label +
          '</span><span class="slots" aria-hidden="true">' + (p.goal > 0 ? slots(p, fresh) : '<span class="nogoal">목표 없음</span>') +
          '</span><span class="s-num">' + fmt(p.sum) + "/" + fmt(p.goal) + "<small>" + p.cat.unit + "</small></span></div>";
      }).join("");
      var seal = s.pct >= 1 ? '<span class="seal" aria-label="모든 목표 달성">참<br>잘했어요</span>' : "";
      return '<article class="card member" style="--c:' + s.m.color + '">' + seal + '<div class="m-head"><span class="m-name"><span class="avatar">' +
        s.m.emoji + "</span>" + esc(s.m.name) + '</span><span class="m-right"><span class="m-pct">' + Math.round(s.pct * 100) +
        '<small>%</small></span><button class="small" data-goal="' + s.m.id + '">목표 수정</button></span></div>' + rows + "</article>";
    }).join("");
  }

  function renderLog() {
    document.getElementById("memberPick").innerHTML = state.members.map(function (m) {
      return '<button type="button" class="chip' + (pick.member === m.id ? " on" : "") + '" data-member="' + m.id + '">' + m.emoji + " " + esc(m.name) + "</button>";
    }).join("");
    document.getElementById("catPick").innerHTML = CATEGORIES.map(function (c) {
      return '<button type="button" class="chip' + (pick.cat === c.key ? " on" : "") + '" data-cat="' + c.key + '">' + c.icon + " " + c.label + "</button>";
    }).join("");
    var c = cat(pick.cat);
    document.getElementById("unitLabel").textContent = c.unit;
    document.getElementById("valueInput").step = c.step;
    document.getElementById("valueInput").min = c.step;

    var recent = state.records.map(function (r, i) { return { r: r, i: i }; })
      .sort(function (a, b) { return b.r.date < a.r.date ? -1 : b.r.date > a.r.date ? 1 : b.i - a.i; }).slice(0, 12);
    document.getElementById("recentList").innerHTML = recent.length ? recent.map(function (x) {
      var m = member(x.r.member) || { name: "?", color: "#999" }, cc = cat(x.r.cat);
      return '<li><span class="dot" style="background:' + m.color + '"></span><div class="grow"><b>' + esc(m.name) + "</b> " +
        cc.icon + " " + cc.label + " " + fmt(Number(x.r.value)) + cc.unit +
        "<small>" + esc(x.r.date.slice(5).replace("-", "/")) + (x.r.memo ? " · " + esc(x.r.memo) : "") +
        '</small></div><button class="small" data-del="' + x.i + '">삭제</button></li>';
    }).join("") : '<li class="empty">아직 기록이 없어요</li>';
  }

  function medal(i) { return ["🥇", "🥈", "🥉"][i] || (i + 1) + "위"; }
  function ranked(st) {
    var s = st.slice().sort(function (a, b) { return b.pct - a.pct; });
    var rank = 0;
    s.forEach(function (x, i) { if (i === 0 || x.pct !== s[i - 1].pct) rank = i; x.rank = rank; });
    return s;
  }
  function renderRank(st) {
    document.getElementById("rankList").innerHTML = ranked(st).map(function (s) {
      return '<li class="r' + s.rank + '" style="--c:' + s.m.color + '"><span class="medal">' + medal(s.rank) + '</span><div class="grow"><b>' + s.m.emoji + " " + esc(s.m.name) +
        '</b><div class="bar"><span style="width:' + Math.round(s.pct * 100) + "%;background:" + s.m.color + '"></span></div></div><span class="pct">' +
        Math.round(s.pct * 100) + "%</span></li>";
    }).join("");
  }

  // ---------- 요약 텍스트 ----------
  function summary() {
    var st = stats(), w = weekRange();
    var fam = Math.round(st.reduce(function (a, s) { return a + s.pct; }, 0) / (st.length || 1) * 100);
    var lines = ["🌟 우리가족 자기계발 (" + (w.mon.getMonth() + 1) + "/" + w.mon.getDate() + "~" + (w.sun.getMonth() + 1) + "/" + w.sun.getDate() + ")",
      "가족 달성률 " + fam + "%", ""];
    ranked(st).forEach(function (s) {
      lines.push(medal(s.rank) + " " + s.m.name + " " + Math.round(s.pct * 100) + "%");
      lines.push("   " + s.per.map(function (p) { return p.cat.icon + fmt(p.sum) + "/" + fmt(p.goal) + p.cat.unit; }).join("  "));
    });
    lines.push("", "서로 응원해요! 💪");
    return lines.join("\n");
  }

  // ---------- 유틸 ----------
  var toastTimer;
  function toast(msg) {
    var t = document.getElementById("toast");
    t.textContent = msg; t.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove("show"); }, 2200);
  }
  function showTab(name) {
    document.querySelectorAll(".tab").forEach(function (t) { t.classList.toggle("active", t.id === "tab-" + name); });
    document.querySelectorAll(".tabbar button").forEach(function (b) {
      var on = b.dataset.tab === name;
      b.classList.toggle("active", on);
      if (on) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
    });
    window.scrollTo(0, 0);
    // 방금 찍은 도장은 '이번 주' 탭이 보일 때 한 번만 찍히는 동작을 보여준다
    if (name === "home" && lastAdd) {
      var f = document.querySelector(".slot.fresh");
      if (f) f.scrollIntoView({ block: "center", behavior: "instant" });
      lastAdd = null;
    }
  }

  // ---------- 이벤트 ----------
  document.querySelector(".tabbar").addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (b) showTab(b.dataset.tab);
  });

  document.getElementById("tab-log").addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b) return;
    if (b.dataset.member) { pick.member = b.dataset.member; renderLog(); }
    else if (b.dataset.cat) { pick.cat = b.dataset.cat; renderLog(); }
    else if (b.dataset.del !== undefined) {
      if (confirm("이 기록을 삭제할까요?")) { state.records.splice(Number(b.dataset.del), 1); save(); render(); toast("삭제했어요"); }
    }
  });

  document.getElementById("logForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var v = parseFloat(document.getElementById("valueInput").value);
    var date = document.getElementById("dateInput").value;
    if (!(v > 0) || !date) { toast("양과 날짜를 확인해 주세요"); return; }
    state.records.push({ member: pick.member, cat: pick.cat, value: v, memo: document.getElementById("memoInput").value.trim(), date: date });
    lastAdd = inWeek(date) ? { member: pick.member, cat: pick.cat } : null;
    save(); render();
    document.getElementById("memoInput").value = "";
    document.getElementById("valueInput").value = 1;
    toast(lastAdd ? "기록했어요. 도장 꾹! 👏" : "기록했어요");
  });

  // 목표 수정
  var goalFor = null;
  document.getElementById("memberCards").addEventListener("click", function (e) {
    var b = e.target.closest("[data-goal]"); if (!b) return;
    goalFor = member(b.dataset.goal);
    document.getElementById("goalTitle").textContent = goalFor.emoji + " " + goalFor.name + " 주간 목표";
    document.getElementById("goalFields").innerHTML = CATEGORIES.map(function (c) {
      return '<div class="goal-row"><span>' + c.icon + " " + c.label + '</span><span><input type="number" min="0" step="' + c.step +
        '" data-gcat="' + c.key + '" value="' + goalFor.goals[c.key] + '"> ' + c.unit + "</span></div>";
    }).join("");
    document.getElementById("goalDialog").showModal();
  });
  document.getElementById("goalForm").addEventListener("submit", function (e) {
    if (e.submitter && e.submitter.value === "ok" && goalFor) {
      document.querySelectorAll("[data-gcat]").forEach(function (i) { goalFor.goals[i.dataset.gcat] = Math.max(0, parseFloat(i.value) || 0); });
      save(); render(); toast("목표를 저장했어요");
    }
  });

  // 공유
  document.getElementById("copyBtn").addEventListener("click", function () {
    var text = summary(), box = document.getElementById("summaryBox");
    function fallback() { box.hidden = false; box.value = text; box.focus(); box.select(); toast("아래 글을 길게 눌러 복사하세요"); }
    if (navigator.clipboard && window.isSecureContext !== false) {
      navigator.clipboard.writeText(text).then(function () { box.hidden = false; box.value = text; toast("복사했어요! 단톡방에 붙여넣기 📋"); }, fallback);
    } else fallback();
  });
  document.getElementById("exportBtn").addEventListener("click", function () {
    var blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "family-tracker-" + iso(new Date()) + ".json";
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    toast("파일로 내보냈어요");
  });
  document.getElementById("importBtn").addEventListener("click", function () { document.getElementById("importFile").click(); });
  document.getElementById("importFile").addEventListener("change", function (e) {
    var f = e.target.files[0]; if (!f) return;
    var rd = new FileReader();
    rd.onload = function () {
      try {
        var d = JSON.parse(rd.result);
        if (!d.members || !d.records) throw 0;
        var seen = {};
        state.records.forEach(function (r) { seen[[r.member, r.cat, r.value, r.date, r.memo].join("|")] = 1; });
        var added = 0;
        d.records.forEach(function (r) {
          var k = [r.member, r.cat, r.value, r.date, r.memo].join("|");
          if (!seen[k] && member(r.member) && cat(r.cat)) { state.records.push(r); seen[k] = 1; added++; }
        });
        save(); render(); toast("기록 " + added + "건을 합쳤어요");
      } catch (err) { toast("올바른 파일이 아니에요"); }
      e.target.value = "";
    };
    rd.readAsText(f);
  });
  document.getElementById("resetBtn").addEventListener("click", function () {
    if (confirm("모든 기록과 목표를 예시 데이터로 되돌릴까요?")) { state = clone(SAMPLE_DATA); pick.member = state.members[0].id; save(); render(); toast("예시로 초기화했어요"); }
  });

  // ---------- 홈 화면에 추가 (PRD 1-2) ----------
  var ua = navigator.userAgent;
  var isIos = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  var isMobile = isIos || /Android/i.test(ua);
  var standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  var NUDGE_KEY = "familyTracker.installNudgeClosed";
  var installEvt = null;

  function setupInstall() {
    var card = document.getElementById("installCard"), nudge = document.getElementById("installNudge");
    if (standalone) { card.hidden = true; nudge.hidden = true; return; } // 이미 홈 화면 앱으로 실행 중
    document.getElementById("kakaoWarn").hidden = !/KAKAOTALK/i.test(ua);
    document.getElementById(isIos ? "howIos" : "howAndroid").open = true;
    var closed = false;
    try { closed = localStorage.getItem(NUDGE_KEY) === "1"; } catch (e) {}
    nudge.hidden = !isMobile || closed;
  }
  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault(); installEvt = e;              // 크롬이 바로 설치 창을 띄울 수 있는 경우
    document.getElementById("installBtn").hidden = false;
  });
  window.addEventListener("appinstalled", function () {
    installEvt = null; document.getElementById("installBtn").hidden = true;
    toast("홈 화면에 추가했어요");
  });
  document.getElementById("installBtn").addEventListener("click", function () {
    if (!installEvt) return;
    installEvt.prompt();
    installEvt.userChoice.then(function () { installEvt = null; document.getElementById("installBtn").hidden = true; });
  });
  document.getElementById("nudgeGo").addEventListener("click", function () {
    showTab("rank");
    document.getElementById("installCard").scrollIntoView({ block: "start" });
  });
  document.getElementById("nudgeClose").addEventListener("click", function () {
    document.getElementById("installNudge").hidden = true;
    try { localStorage.setItem(NUDGE_KEY, "1"); } catch (e) {}
  });
  if ("serviceWorker" in navigator && window.isSecureContext) {
    window.addEventListener("load", function () { navigator.serviceWorker.register("sw.js").catch(function () {}); });
  }

  document.getElementById("dateInput").value = iso(new Date());
  setupInstall();
  render();
})();
