import { sb as e } from "./supabase.js";
const s = {
    p: null,
    session: null,
    reasons: [],
    curriculumItems: new Map(),
    schedules: new Map(),
    scheduleChapters: new Map(),
    scheduleScopes: new Map(),
    scheduleAssessors: new Map(),
    assessorYears: new Map(),
    curriculumChapter: null,
    aiCurriculumDraft: null,
    accountUsers: new Map(),
  },
  t = (e) => document.querySelector(e),
  a = t("#content"),
  i = t("#modal"),
  r = t("#modalBody"),
  n = [1, 2, 3, 4, 5],
  o = (e) =>
    String(e ?? "").replace(
      /[&<>"']/g,
      (e) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[e],
    ),
  d = (e) => {
    if (!e) return "—";
    const value = /^\d{4}-\d{2}-\d{2}$/.test(String(e)) ? new Date(`${e}T12:00:00`) : new Date(e);
    const day = String(value.getDate()).padStart(2, "0");
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const year = value.getFullYear();
    const weekday = new Intl.DateTimeFormat("en-GB", { weekday: "short" }).format(value).toUpperCase();
    return `${weekday}/${day}/${month}/${year}`;
  },
  l = (e) =>
    e
      ? `${d(e)} · ${new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(new Date(e))}`
      : "—",
  c = (e) => {
    if (!e) return "";
    const s = new Date(e);
    return (
      s.setMinutes(s.getMinutes() - s.getTimezoneOffset()),
      s.toISOString().slice(0, 16)
    );
  },
  messageBody = (message) => {
    let body = String(message?.body || "");
    if (message?.senior_resident_name) {
      body = body.replace(/Senior resident:\s*(approved|pending|rejected)/i, `Senior resident: ${message.senior_resident_name} ($1)`);
    }
    body = body.replace(/\bReclaim\b/gi, "Request to reconsider");
    return o(body).replace(/\n/g, "<br>");
  },
  u = ({ data: e, error: s }) => {
    if (s) throw s;
    return e;
  },
  reviewRpcResult = async (residentId = null) => {
    let last = { data: null, error: new Error("Unable to load reviews") };
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        last = await e.rpc("get_visible_observer_reviews", { p_resident_id: residentId });
      } catch (error) {
        last = { data: null, error };
      }
      if (!last?.error) return last;
      const message = String(last.error?.message || last.error || "").toLowerCase();
      const transient = message.includes("failed to fetch") || message.includes("network") || message.includes("load failed");
      if (!transient || attempt === 2) return last;
      await new Promise((resolve) => setTimeout(resolve, 350 * (attempt + 1)));
    }
    return last;
  },
  reviewReconsiderationMessage = (message, review) => {
    if (!review) return `<div class="message-body">${messageBody(message)}</div>`;
    const category = String(review.category || "clinical");
    const categoryLabel = category.charAt(0).toUpperCase() + category.slice(1);
    return `<div class="reconsideration-message-summary">
      <div class="reconsideration-summary-row"><span>Resident</span><b>${o(review.resident_name || message.sender_name || "Resident")}</b></div>
      <div class="reconsideration-summary-row"><span>Review</span><b>${o(categoryLabel)} review</b></div>
      <div class="reconsideration-summary-reason"><span>Reason</span><p>${o(review.reconsideration_text || "No reason provided")}</p></div>
    </div>`;
  },
  linkedReviewMessage = (message, review) => {
    if (!review) return `<div class="message-body">${messageBody(message)}</div>`;
    const rawCategory = String(review.category || "").toLowerCase();
    const domain = rawCategory === "attitude" ? "Behavioural" : "Clinical";
    const categoryLabel = rawCategory === "attitude" ? "Behaviour" : rawCategory === "skill" ? "Skill" : rawCategory === "knowledge" ? "Knowledge" : "Review";
    const sentiment = String(review.sentiment || "positive") === "negative" ? "Negative" : "Positive";
    const reviewer = review.display_observer || review.observer_signature || message.sender_name || "Reviewer";
    const reconsideration = String(review.reconsideration_status || "none");
    return `<div class="linked-review-message">
      <div class="linked-review-grid">
        <div><span>Resident</span><b>${o(review.resident_name || "Resident")}</b></div>
        <div><span>Domain</span><b>${o(domain)} · ${o(categoryLabel)}</b></div>
        <div><span>Type</span><b>${sentiment === "Negative" ? "👎" : "👍"} ${o(sentiment)}</b></div>
        <div><span>Reviewer</span><b>${o(reviewer)}</b></div>
        <div><span>Date</span><b>${o(d(review.observed_on))}</b></div>
        <div><span>Place</span><b>${o(review.place || "—")}</b></div>
      </div>
      <div class="linked-review-content"><span>Review content</span><p>${o(review.comment || "—")}</p></div>
      ${reconsideration !== "none" ? `<div class="linked-review-status"><span>Reconsideration</span><b>${o(reconsideration === "accepted" ? "💡 Modified after reconsideration" : reconsideration === "upheld" ? "Original review upheld" : "Pending")}</b></div>` : ""}
    </div>`;
  },
  p = {
    resident: [
      ["dashboard", "Dashboard"],
      ["chapters", "My chapters"],
      ["assessments", "My assessments"],
      ["reviews", "My reviews"],
      ["logbook", "My logbook"],
      ["logbook-requests", "Logbook requests"],
      ["inbox", "Inbox"],
      ["profile", "My profile"],
    ],
    observer: [
      ["dashboard", "Dashboard"],
      ["write-review", "Write a review"],
      ["reviews", "My reviews"],
      ["logbook", "Logbook approvals"],
      ["logbook-requests", "Requests"],
      ["inbox", "Inbox"],
      ["profile", "My profile"],
    ],
    assessor: [
      ["dashboard", "Dashboard"],
      ["residents", "Assigned residents"],
      ["write-review", "Reviews"],
      ["assessments", "Assessments"],
      ["logbook", "Resident logbooks"],
      ["logbook-requests", "Logbook requests"],
      ["inbox", "Inbox"],
      ["profile", "My profile"],
    ],
    owner: [
      ["dashboard", "Overview"],
      ["users", "Accounts"],
      ["curriculum", "Curriculum"],
      ["owner-assessment-center", "Assessments"],
      ["owner-logbook-center", "Logbooks"],
      ["inbox", "Inbox"],
      ["owner-tools", "More"],
    ],
  },
  m = (e) =>
    ({
      resident: "Resident",
      observer: "Observer",
      assessor: "Assessor",
      owner: "Program Owner",
    })[e],
  h = (e, s, t = "") =>
    ` <div class="lead"> <div> <h2>${o(e)}</h2> <p>${o(s)}</p> </div> ${t} </div>`,
  v = (e) => ` <div class="card empty-state"> <p>${o(e)}</p> </div>`,
  _ = (e, s, t) =>
    ` <article class="card metric"> <span>${o(e)}</span> <b>${o(s)}</b> <small>${o(t)}</small> </article>`,
  yearClass = (year) => `year-${Math.max(1, Math.min(5, Number(year) || 1))}`,
  yearChip = (year, label = "") =>
    `<span class="year-chip ${yearClass(year)}">${o(label || `Year ${year}`)}</span>`,
  dashboardTile = (title, valueHtml, meta, go, extraClass = "") =>
    `<button type="button" class="dashboard-tile ${extraClass}" ${go ? `data-go="${o(go)}"` : ""}><span>${o(title)}</span><strong>${valueHtml}</strong><small>${o(meta || "")}</small></button>`,
  evidenceDashboardTile = (knowledgeCount, skillCount) =>
    `<button type="button" class="dashboard-tile evidence-dashboard-tile" data-go="chapters"><span>Knowledge & skills</span><div class="evidence-split"><div><b>${o(knowledgeCount)}</b><small>Knowledge complete</small></div><div><b>${o(skillCount)}</b><small>Skills tracked</small></div></div><small>Open curriculum and update your progress</small></button>`,
  weakPointSummary = (assessment) => {
    if (!assessment) return "No formal assessment yet";
    const weak = [];
    Number(assessment.knowledge_score) < 6 && weak.push(`Knowledge ${assessment.knowledge_score}/10`);
    Number(assessment.skills_score) < 7 && weak.push(`Skills ${assessment.skills_score}/10`);
    Number(assessment.attitude_score) < 8 && weak.push(`Attitude ${assessment.attitude_score}/10`);
    return weak.length ? `Focus: ${weak.join(" · ")}` : assessment.overall_pass ? "Passed" : "Review assessor feedback";
  },
  participationLabel = (value) =>
    ({
      attended: "Attended",
      failed_trial: "Failed trial",
      assisted: "Performed with assistance",
      solo_guided: "Performed solo under guidance",
      solo_unguided: "Performed solo without guidance",
      solo: "Performed solo without guidance",
    })[value] || String(value || "—"),
  b = (e) => {
    const s = t("#toast");
    ((s.textContent = e),
      (s.style.display = "block"),
      setTimeout(() => {
        s.style.display = "none";
      }, 3500));
  },
  g = (e) => {
    location.hash = e;
    t("aside")?.classList.remove("open");
    t("#backdrop")?.classList.remove("show");
  },
  y = (e) => {
    ((r.innerHTML = e), i.showModal());
  };
function f() {
  const e = s.p;
  const a = e.avatar_url
    ? `<img class="nav-avatar" src="${o(e.avatar_url)}" alt="">`
    : `<span class="nav-avatar avatar-fallback">${o((e.display_name || e.username || "?").charAt(0).toUpperCase())}</span>`;
  ((t("#userCard").innerHTML =
    `${a}<span><strong>${o(e.display_name || e.username)}</strong><br><small>${m(e.role)}</small></span>`),
    (t("#profileChip").innerHTML =
      `${a}<span>${o(e.display_name || e.username)}</span>`),
    (t("#nav").innerHTML = p[e.role]
      .map(
        ([e, s]) =>
          `<button data-go="${e}"><span>${o(s)}</span>${e === "inbox" ? '<span class="nav-badge" data-inbox-badge hidden>0</span>' : e === "logbook-requests" ? '<span class="nav-badge" data-logbook-badge hidden>0</span>' : ""}</button>`,
      )
      .join("")),
    (t("#loading").hidden = !0),
    (t("#shell").hidden = !1),
    q());
}
function countUnreadInboxThreads(messages = [], reviewActions = []) {
  const reviewByMessage = new Map(reviewActions.map((row) => [String(row.message_id), String(row.review_id)]));
  const unreadKeys = new Set();
  messages.forEach((message) => {
    if (message.is_read) return;
    const reviewId = reviewByMessage.get(String(message.id));
    unreadKeys.add(reviewId ? `review:${reviewId}` : `message:${message.id}`);
  });
  return unreadKeys.size;
}

async function q() {
  const juniorResident = s.p.role === "resident" && Number(s.p.residency_year) <= 2;
  const [normalResult, logbookResult, reconsiderationResult, reviewActionResult] = await Promise.all([
    e.rpc("get_private_messages", { p_box: "inbox" }),
    e.rpc("get_logbook_messages", { p_view: juniorResident ? "updates" : "received" }),
    e.rpc("get_my_logbook_reconsiderations_v1044"),
    e.rpc("get_my_review_message_actions_v1051"),
  ]);
  const count = countUnreadInboxThreads(normalResult.data || [], reviewActionResult.data || []);
  document.querySelectorAll("[data-inbox-badge]").forEach((badge) => {
    badge.textContent = count;
    badge.hidden = count === 0;
  });
  const messageCount = (logbookResult.data || []).filter((message) => juniorResident ? !message.is_read : !message.logbook_action_taken).length;
  const reconsiderationCount = (reconsiderationResult.data || []).filter((row) => String(row.reviewer_id) === String(s.p.id) && row.status === "requested").length;
  const logbookCount = messageCount + reconsiderationCount;
  document.querySelectorAll("[data-logbook-badge]").forEach((badge) => {
    badge.textContent = logbookCount;
    badge.hidden = logbookCount === 0;
  });
}
async function $() {
  const [e = "dashboard", s = ""] = location.hash.slice(1).split(":");
  a.classList.remove("mail-content");
  (document.querySelectorAll("[data-go]").forEach((s) => {
    s.classList.toggle("active", s.dataset.go === e);
  }),
    (a.innerHTML = v("Loading…")));
  try {
    await (w[e] || k)(s);
  } catch (e) {
    (console.error(e), (a.innerHTML = v(e.message || "Unable to load")));
  }
}
const w = {
  dashboard: k,
  chapters: async function () {
    if ("resident" !== s.p.role) return g("dashboard");
    t("#title").textContent = "My chapters";
    const { data: i } = await e
      .from("chapters")
      .select("*")
      .lte("year_from", s.p.residency_year)
      .eq("is_active", !0)
      .order("year_from")
      .order("sort_order");
    const currentYear = Number(s.p.residency_year);
    const accessible = i || [];
    const current = accessible.filter((chapter) => Number(chapter.year_from) <= currentYear && Number(chapter.year_to || chapter.year_from) >= currentYear);
    const past = accessible.filter((chapter) => Number(chapter.year_to || chapter.year_from) < currentYear);
    const chapterCards = (rows) => rows.map((chapter) => ` <article class="card chapter" data-chapter="${chapter.id}"> ${yearChip(chapter.year_from, "Year " + chapter.year_from + (chapter.year_to > chapter.year_from ? "–" + chapter.year_to : ""))} <h3>${o(chapter.title)}</h3> <p>${o(chapter.description)}</p> </article>`).join("");
    a.innerHTML =
      h(
        "Your cardiology curriculum",
        "Your current-year chapters are kept at the top. Earlier curriculum remains available below for revision.",
        '<button class="btn secondary" data-export-curriculum>Export curriculum PDF</button>',
      ) +
      `<section class="chapter-group current-chapter-group"><div class="chapter-group-head"><div><span class="eyebrow">Current active curriculum</span><h2>Year ${currentYear} chapters</h2></div>${yearChip(currentYear)}</div><div class="chapters">${chapterCards(current) || v("No active chapters are assigned to your current year.")}</div></section>` +
      (past.length ? `<section class="chapter-group past-chapter-group top-gap"><div class="chapter-group-head"><div><span class="eyebrow">Previous curriculum</span><h2>Past chapters</h2></div><small>Still available for revision</small></div><div class="chapters past-chapters">${chapterCards(past)}</div></section>` : "");
  },
  chapter: async function (i) {
    const r = await Promise.all([
        e.from("chapters").select("*").eq("id", i).single(),
        e
          .from("knowledge_items")
          .select("*")
          .eq("chapter_id", i)
          .eq("is_active", !0)
          .order("sort_order"),
        e
          .from("skills")
          .select("*")
          .eq("chapter_id", i)
          .eq("is_active", !0)
          .order("sort_order"),
        e.from("knowledge_progress").select("*").eq("resident_id", s.p.id),
        e.from("skill_levels").select("*").eq("resident_id", s.p.id),
        e.from("skill_logs").select("skill_id").eq("resident_id", s.p.id),
      ]),
      [chapter, knowledgeItems, skills, knowledgeProgress, skillLevels, skillLogs] = r.map(u);
    t("#title").textContent = chapter.title;
    const knowledgeMap = new Map(knowledgeProgress?.map((item) => [item.knowledge_item_id, item.status])),
      skillMap = new Map(skillLevels?.map((item) => [item.skill_id, item.level]));
    const levelGuide = [
      [1, "Observer"],
      [2, "Direct supervision"],
      [3, "Limited supervision"],
      [4, "Independent"],
      [5, "Expert / supervisor"],
    ];
    const skillRows = skills.map((skill) => {
      const logs = skillLogs?.filter((item) => item.skill_id === skill.id).length || 0;
      return `<tr>
        <td class="skill-name-cell"><b>${o(skill.title)}</b>${skill.description ? `<small>${o(skill.description)}</small>` : ""}<button class="text-link skill-log-link" data-log="${skill.id}" data-name="${o(skill.title)}">Add performance · ${logs} log${logs === 1 ? "" : "s"}</button></td>
        ${n.map((level) => `<td class="skill-level-cell"><label class="skill-level-choice" title="Level ${level}: ${o(levelGuide[level - 1][1])}"><input type="checkbox" name="skill-level-${skill.id}" data-level="${skill.id}" value="${level}" ${Number(skillMap.get(skill.id)) === level ? "checked" : ""}><span>${level}</span></label></td>`).join("")}
      </tr>`;
    }).join("");
    a.innerHTML =
      h(
        chapter.title,
        chapter.description,
        '<button class="btn secondary" data-go="chapters">All chapters</button>',
      ) +
      `<section class="card chapter-knowledge-card">
        <div class="section-head compact-section-head"><div><h3>Knowledge</h3><p>${knowledgeItems.length} points</p></div><div class="section-actions"><button class="btn small secondary" data-knowledge-bulk="all">Select all</button><button class="btn small secondary" data-knowledge-bulk="none">Deselect all</button></div></div>
        <div class="items knowledge-progress-list">${knowledgeItems.map((item) => ` <label class="item knowledge-progress-item"><span class="check-line"><input class="knowledge-progress-checkbox" type="checkbox" data-k="${item.id}" ${"completed" === knowledgeMap.get(item.id) ? "checked" : ""}><b>${o(item.title)}</b></span>${item.description ? `<p>${o(item.description)}</p>` : ""}</label>`).join("") || v("No knowledge points in this chapter.")}</div>
      </section>
      <section class="card top-gap chapter-skills-card">
        <div class="section-head compact-section-head"><div><h3>Skills and independence level</h3><p>Choose your current level for each skill.</p></div></div>
        <div class="skill-level-guidance" aria-label="Five levels of independence">${levelGuide.map(([level, label]) => `<div><b>${level}</b><span>${o(label)}</span></div>`).join("")}</div>
        <div class="table-scroll skill-level-scroll"><table class="skill-level-table"><thead><tr><th>Skill</th>${n.map((level) => `<th title="${o(levelGuide[level - 1][1])}">${level}</th>`).join("")}</tr></thead><tbody>${skillRows || `<tr><td colspan="6">No skills in this chapter.</td></tr>`}</tbody></table></div>
      </section>`;
  },
  assessments: async function () {
    if ("observer" === s.p.role) return g("dashboard");
    t("#title").textContent =
      "resident" === s.p.role ? "My assessments" : "Assessments";
    let i = e
      .from("assessments")
      .select("*")
      .order("assessment_date", { ascending: !1 });
    "resident" === s.p.role && (i = i.eq("resident_id", s.p.id));
    "assessor" === s.p.role && (i = i.eq("assessor_id", s.p.id));
    const r = await i;
    let n = "";
    if ("owner" !== s.p.role) {
      let assignedYears = new Set();
      if ("resident" === s.p.role) {
        assignedYears.add(Number(s.p.residency_year));
      }
      const scheduleResult =
          "assessor" === s.p.role
            ? await e.rpc("my_assessor_schedule")
            : await e
                .from("assessment_schedules")
                .select(
                  "*,assessment_schedule_chapters(chapter_id,chapters(title))",
                )
                .eq("is_active", !0)
                .eq("residency_year", s.p.residency_year)
                .order("starts_at"),
        scheduleRows = scheduleResult.data || [],
        relevantSchedules = scheduleRows
          .filter((item) => item.schedule_status !== "finished")
          .sort((x, y) => new Date(x.starts_at) - new Date(y.starts_at));
      if (scheduleResult.error) {
        n = ` <section class="card warning"><h3>Schedule could not load</h3><p>${o(scheduleResult.error.message)}</p></section>`;
      } else if (relevantSchedules.length) {
        n = ` <section class="card window-summary"> <h3>Upcoming assessments for your assigned ${assignedYears.size === 1 ? "year" : "years"}</h3> <div class="window-list">${relevantSchedules
          .map((item) => {
            const [status, className] = N(item),
              chapters =
                (item.chapters || item.assessment_schedule_chapters)
                  ?.map((scope) => scope.title || scope.chapters?.title)
                  .filter(Boolean) || [];
            return ` <article> <span class="tag ${className}">${status}</span> <div><b>${o(item.title)}</b><small>Year ${item.residency_year} · ${l(item.starts_at)} – ${l(item.ends_at)}</small>${chapters.length ? `<small>Chapters: ${o(chapters.join(" · "))}</small>` : "<small>Whole-year assessment</small>"}</div> </article>`;
          })
          .join("")}</div> </section>`;
      } else {
        n = ` <section class="card window-summary quiet"><h3>Upcoming assessments</h3><p>No upcoming assessment is currently scheduled for your assigned ${assignedYears.size === 1 ? "year" : "years"}.</p></section>`;
      }
    }
    a.innerHTML =
      h(
        "Assessment schedule and history",
        "See upcoming assessments for every year assigned to you and the assessments you have completed.",
      ) +
      n +
      ` <section class="top-gap"><h2>${"assessor" === s.p.role ? "Completed assessments by you" : "Completed assessments"}</h2><div class="grid top-gap"> ${r.data?.map(A).join("") || v("No completed assessments recorded yet.")} </div></section>`;
  },
  logbook: P,
  profile: x,
  reviews: async function () {
    if (!["observer", "assessor", "resident"].includes(s.p.role)) return g("dashboard");
    if (s.p.role === "assessor") return g("write-review");
    t("#title").textContent = "My reviews";
    const reviewResult = await reviewRpcResult(s.p.role === "resident" ? s.p.id : null);
    if (reviewResult.error) {
      a.innerHTML = h("My reviews", "Your clinical review history.") +
        `<section class="card review-load-error"><h3>Reviews could not load</h3><p>${o(reviewResult.error.message || "Temporary connection problem")}</p><button class="btn" data-retry-reviews>Try again</button></section>`;
      return;
    }
    const rows = reviewResult.data || [];
    window.observerReviewRows = new Map(rows.map((row) => [String(row.id), row]));
    a.innerHTML = s.p.role === "resident"
      ? h("Reviews about me", "Filter your clinical and behavioural reviews in one table, including good/bad feedback and reconsideration status.") + renderResidentReviewGroups(rows)
      : h("Comments written by you", "Your review history. Anonymous reviews remain anonymous to the resident and other assigned assessors, but the Program Owner can identify the author.") + renderCommentsTable(rows, "author");
  },
  residents: async function () {
    if ("assessor" !== s.p.role) return g("dashboard");
    const [{ data: t }, { data: i }] = await Promise.all([
        S(),
        e
          .from("assessor_year_assignments")
          .select("residency_year")
          .eq("assessor_id", s.p.id)
          .eq("is_active", !0)
          .order("residency_year"),
      ]),
      r = (i || []).map((e) => `Year ${e.residency_year}`).join(", ");
    a.innerHTML =
      h(
        "Assigned residents",
        r
          ? `Your current cohorts: ${r}.`
          : "The owner has not assigned a residency year to you yet.",
      ) + C(t || []);
  },
  candidate: async function (t) {
    const [i] = t.split("~"),
      [r, n, d, c, u, p] = await Promise.all([
        e.from("profiles").select("*").eq("id", i).single(),
        reviewRpcResult(i),
        e.from("skill_logs").select("*").eq("resident_id", i),
        e
          .from("knowledge_progress")
          .select("*")
          .eq("resident_id", i)
          .eq("status", "completed"),
        e
          .from("assessments")
          .select("*")
          .eq("resident_id", i)
          .order("assessment_date", { ascending: !1 }),
        e
          .from("assessment_schedules")
          .select("*")
          .eq("is_active", !0)
          .order("starts_at"),
      ]),
      m = r.data,
      b = (p.data || []).filter(
        (e) =>
          Number(e.residency_year) === Number(m.residency_year) &&
          (!e.assessor_id || e.assessor_id === s.p.id),
      ),
      g = Date.now(),
      y = b
        .filter(
          (e) =>
            new Date(e.starts_at).getTime() <= g &&
            new Date(e.ends_at).getTime() >= g,
        )
        .map(
          (e) =>
            ` <button class="btn" data-assess="${i}" data-schedule-id="${e.id}" data-assessment-type="${e.assessment_type}" data-cid="${e.chapter_id || ""}" data-name="${o(m.display_name || m.username)}"> Start ${o(e.title)} </button>`,
        )
        .join(""),
      f = b.length
        ? ` <section class="card window-summary"> <h3>Assessment schedule</h3> <div class="window-list">${b
            .map((e) => {
              const [s, t] = N(e);
              return ` <article> <span class="tag ${t}">${s}</span> <div><b>${o(e.title)}</b><small>${l(e.starts_at)} – ${l(e.ends_at)}</small></div> </article>`;
            })
            .join("")}</div> </section>`
        : ` <div class="card warning"> <b>No assessment window is scheduled for Year ${m.residency_year}.</b> <p>The owner must schedule and open an assessment window before scoring can begin.</p> </div>`;
    a.innerHTML =
      h(
        m.display_name || m.username,
        "Review all evidence before formal scoring.",
        y,
      ) +
      f +
      ` <div class="grid g3 top-gap"> ${_("Knowledge complete", c.data?.length || 0, "topics")} ${_("Skill logs", d.data?.length || 0, "performances")} ${_("Previous assessments", u.data?.length || 0, "records")} </div> <div class="top-gap">${renderCommentsTable(n.data || [])}</div> <div class="grid top-gap">${u.data?.map(A).join("") || v("No previous assessments.")}</div>`;
  },
  comments: async function () {
    if (s.p.role === "assessor") return g("write-review");
    if (s.p.role !== "owner") return g("dashboard");
    const rows = u(await reviewRpcResult(null)) || [];
    window.observerReviewRows = new Map(rows.map((row) => [String(row.id), row]));
    a.innerHTML =
      h(
        "Observer comments",
        s.p.role === "owner"
          ? "All clinical reviews, including the real author of anonymous reviews and every reconsideration outcome."
          : "Clinical reviews for your assigned residents. Anonymous authors remain hidden from assessors.",
      ) + renderCommentsTable(rows, s.p.role === "owner" ? "owner" : "assessor");
  },
  users: async function () {
    if ("owner" !== s.p.role) return g("dashboard");
    const [profilesResult, yearsResult] = await Promise.all([
        e.from("profiles").select("*").order("display_name"),
        e
          .from("assessor_year_assignments")
          .select("assessor_id,residency_year")
          .eq("is_active", !0)
          .order("residency_year"),
      ]),
      profiles = profilesResult.data || [],
      assignedYears = M(yearsResult.data || []);
    s.accountUsers = new Map(profiles.map((person) => [String(person.id), person]));
    const cards = profiles.map((person) => {
      const roleLabel = m(person.role);
      const years = assignedYears.get(person.id) || [];
      const access = person.role === "resident"
        ? yearChip(person.residency_year)
        : person.role === "assessor"
          ? (years.length ? `<div class="year-chips">${years.map((year) => yearChip(year)).join("")}</div>` : '<span class="muted">No cohort assigned</span>')
          : '<span class="muted">—</span>';
      const searchable = o(`${person.display_name || ""} ${person.username || ""} ${person.email || ""} ${roleLabel}`.toLowerCase());
      return `<article class="account-row" data-account-search="${searchable}" data-account-role="${o(person.role)}">
        <div class="account-identity"><b>${o(person.display_name || person.username)}</b><small>@${o(person.username || "")}</small></div>
        <div class="account-email"><small>Email</small><span>${o(person.email || "—")}</span></div>
        <div class="account-role"><small>Role</small><b>${o(roleLabel)}</b></div>
        <div class="account-year"><small>${person.role === "assessor" ? "Cohorts" : "Residency"}</small>${access}</div>
        <div class="account-actions">${person.role === "owner" ? '<span class="tag">Owner</span>' : `<button class="btn secondary small" data-manage-account="${person.id}">Manage</button><button class="btn ${person.is_active ? "danger" : "success"} small" data-status="${person.id}" data-active="${!person.is_active}">${person.is_active ? "Suspend" : "Activate"}</button>`}</div>
      </article>`;
    }).join("");
    a.innerHTML =
      h(
        "Accounts & roles",
        "Change resident year, convert roles, or manage access without deleting historical records.",
        '<button class="btn" data-create>Create account</button>',
      ) +
      `<section class="card account-panel"><div class="account-toolbar"><input id="accountSearch" type="search" placeholder="Search name, username or email"><select id="accountRoleFilter"><option value="">All roles</option><option value="resident">Residents</option><option value="observer">Observers</option><option value="assessor">Assessors</option></select></div><div class="account-list">${cards || '<div class="panel-empty">No accounts.</div>'}</div></section>`;
  },
  progress: async function () {
    if ("owner" !== s.p.role) return g("dashboard");
    const { data: t } = await e.rpc("owner_resident_progress");
    a.innerHTML =
      h(
        "Resident progress",
        "End-of-year progression is automatic when the assessment window is marked for progression. Legacy eligible records can still be confirmed manually.",
      ) +
      ` <section class="card table-card"> <div class="table-scroll"> <table class="table"> <thead><tr><th>Resident</th><th>Year</th><th>Knowledge</th><th>Logs</th><th>Status</th><th></th></tr></thead> <tbody>${t.map((e) => ` <tr> <td>${o(e.display_name)}</td> <td>${yearChip(e.residency_year)}</td> <td>${e.knowledge_completed}</td> <td>${e.skill_log_count}</td> <td><span class="tag ${"eligible_for_upgrade" === e.progression_status ? "success" : "reassessment_required" === e.progression_status ? "warning" : ""}">${o(e.progression_status.replaceAll("_", " "))}</span>${e.reassessment_due ? `<br><small>Due ${d(e.reassessment_due)}</small>` : ""}</td> <td>${"eligible_for_upgrade" === e.progression_status && e.residency_year < 5 ? `<button class="btn small" data-upgrade="${e.id}" data-name="${o(e.display_name)}">Legacy upgrade</button>` : ""}</td> </tr>`).join("")}</tbody> </table> </div> </section>`;
  },
  assignments: j,
  curriculum: async function (i) {
    if ("owner" !== s.p.role) return g("dashboard");
    if (((t("#title").textContent = "Curriculum"), !i)) {
      const [s, t, i] = await Promise.all([
        e.from("chapters").select("*").order("year_from").order("sort_order"),
        e.from("knowledge_items").select("chapter_id,is_active"),
        e.from("skills").select("chapter_id,is_active"),
      ]).then((e) => e.map(u));
      return void (a.innerHTML =
        h(
          "Curriculum editor",
          "Choose a chapter to manage every knowledge point and practical skill.",
          '<div class="lead-actions"><button class="btn secondary" data-export-curriculum>Export curriculum PDF</button><button class="btn bulk-paste-btn" data-bulk-curriculum>Bulk add by copy/paste</button></div>',
        ) +
        `<div class="chapters">${s
          .map((e) => {
            const s = t.filter(
                (s) => s.chapter_id === e.id && s.is_active,
              ).length,
              a = i.filter((s) => s.chapter_id === e.id && s.is_active).length;
            return ` <article class="card chapter"> ${yearChip(e.year_from, "Year " + e.year_from + (e.year_to > e.year_from ? "–" + e.year_to : ""))} <h3>${o(e.title)}</h3> <p>${o(e.description || "")}</p> <p><b>${s}</b> knowledge points · <b>${a}</b> skills</p> <button class="btn" data-curriculum-chapter="${e.id}">Manage chapter</button> </article>`;
          })
          .join("")}</div>`);
    }
    s.curriculumItems.clear();
    const [r, n, d] = await Promise.all([
      e.from("chapters").select("*").eq("id", i).single(),
      e
        .from("knowledge_items")
        .select("*")
        .eq("chapter_id", i)
        .eq("is_active", true)
        .order("sort_order")
        .order("id"),
      e
        .from("skills")
        .select("*")
        .eq("chapter_id", i)
        .eq("is_active", true)
        .order("sort_order")
        .order("id"),
    ]).then((e) => e.map(u));
    s.curriculumChapter = r;
    a.innerHTML =
      h(
        r.title,
        "Add, edit or delete current curriculum items. Items linked to resident evidence are safely archived rather than destroying history.",
        `<div class="lead-actions"><button class="btn bulk-paste-btn" data-bulk-curriculum>Bulk add any chapter</button><button class="btn ai-btn" data-ai-curriculum="${r.id}">AI from European guideline</button><button class="btn danger" data-reset-chapter-curriculum="${r.id}" data-chapter-title="${o(r.title)}">Reset chapter</button><button class="btn secondary" data-go="curriculum">All chapters</button></div>`,
      ) +
      ` <section class="card ai-guideline-callout"><div><span class="eyebrow">AI curriculum assistant</span><h3>Generate knowledge and skills from a European guideline</h3><p>Upload the guideline PDF. AI creates a reviewable draft only; nothing is added until you select and import the items.</p></div><button class="btn ai-btn" data-ai-curriculum="${r.id}">Generate draft</button></section> <div class="grid g2 curriculum-columns top-gap"> <section class="card"> <div class="section-head"> <div><h3>Knowledge points</h3><p>${n.length} items</p></div><div class="section-actions"><button class="btn secondary" data-bulk-curriculum-kind="knowledge" data-chapter-id="${r.id}">Bulk paste</button><button class="btn" data-curriculum-add="knowledge" data-chapter-id="${r.id}">Add one</button></div> </div> <div class="items">${n.map((e) => L("knowledge", e)).join("") || v("No knowledge points yet.")}</div> </section> <section class="card"> <div class="section-head"> <div><h3>Skills</h3><p>${d.length} items</p></div><div class="section-actions"><button class="btn secondary" data-bulk-curriculum-kind="skill" data-chapter-id="${r.id}">Bulk paste</button><button class="btn" data-curriculum-add="skill" data-chapter-id="${r.id}">Add one</button></div> </div> <div class="items">${d.map((e) => L("skill", e)).join("") || v("No skills yet.")}</div> </section> </div>`;
  },
  schedule: async function () {
    if ("owner" !== s.p.role) return g("dashboard");
    t("#title").textContent = "Assessment schedule";
    const [i, r, n, o, scopeLinks] = await Promise.all([
      e
        .from("assessment_schedules")
        .select("*")
        .order("starts_at", { ascending: !1 }),
      e
        .from("chapters")
        .select("id,title,year_from,year_to")
        .order("year_from"),
      e
        .from("profiles")
        .select("id,display_name,is_active")
        .eq("role", "assessor")
        .order("display_name"),
      e
        .from("assessor_year_assignments")
        .select("assessor_id,residency_year")
        .eq("is_active", !0)
        .order("residency_year"),
      e.from("assessment_schedule_chapters").select("schedule_id,chapter_id"),
    ]).then((e) => e.map(u));
    ((s.schedules = new Map(i.map((e) => [String(e.id), e]))),
      (s.scheduleChapters = new Map(r.map((e) => [Number(e.id), e]))),
      (s.scheduleScopes = scopeLinks.reduce((map, link) => {
        const list = map.get(String(link.schedule_id)) || [];
        list.push(Number(link.chapter_id));
        map.set(String(link.schedule_id), list);
        return map;
      }, new Map())),
      (s.scheduleAssessors = new Map(n.map((e) => [e.id, e]))),
      (s.assessorYears = M(o)),
      (a.innerHTML =
        h(
          "Assessment windows",
          "Set the opening and closing time, cohort, scope and assessor.",
          '<button class="btn" data-schedule-add>Schedule assessment</button>',
        ) +
        (i.length
          ? ` <section class="card schedule-panel"> <div class="table-scroll"> <table class="schedule-table"> <thead><tr> <th>Assessment</th> <th>Cohort</th> <th>Window</th> <th>Scope</th> <th><span class="sr-only">Action</span></th> </tr></thead> <tbody>${i.map(D).join("")}</tbody> </table> </div> </section>`
          : v("No assessment windows have been scheduled."))));
  },
  inbox: inboxPage,
  "logbook-requests": logbookRequestsPage,
  "message-cleanup": ownerMessageCleanupPage,
  "owner-assessment-center": ownerAssessmentCenterPage,
  "owner-logbook-center": ownerLogbookCenterPage,
  "owner-intervention-audit": ownerInterventionAuditPage,
  "owner-tools": ownerToolsPage,
  "owner-test-reset": ownerTestResetPage,
  "write-review": reviewPage,
  password: x,
};

async function reviewPage() {
  if (!["observer", "assessor"].includes(s.p.role)) return g("dashboard");
  t("#title").textContent = s.p.role === "assessor" ? "Reviews" : "Write a review";

  if (s.p.role === "observer") {
    a.innerHTML =
      h(
        "Record a clinical or behavioural observation",
        "Choose any resident, then record a clinical or behavioural observation, choose positive or developmental feedback, and decide whether your identity is shown.",
      ) +
      `<section class="card"><div class="form-grid">
        <label>Search resident<input id="findResident" placeholder="Name or username"></label>
        <label>Residency year<select id="findYear"><option value="">All years</option>${n.map((year) => `<option>${year}</option>`).join("")}</select></label>
      </div><div id="results" class="top-gap">${v("Loading residents…")}</div></section>`;
    await R();
    return;
  }

  const reviewResult = await reviewRpcResult(null);
  if (reviewResult.error) {
    a.innerHTML = h("Reviews", "Submit and navigate clinical reviews from one workspace.") +
      `<section class="card review-load-error"><h3>Reviews could not load</h3><p>${o(reviewResult.error.message || "Temporary connection problem")}</p><button class="btn" data-retry-reviews>Try again</button></section>`;
    return;
  }

  const visible = reviewResult.data || [];
  const mine = visible.filter((row) => row.is_mine === true || String(row.observer_id || "") === String(s.p.id));
  const others = visible.filter((row) => !(row.is_mine === true || String(row.observer_id || "") === String(s.p.id)));
  const mineHtml = renderCommentsTable(mine, "author");
  const othersHtml = renderCommentsTable(others, "assessor");
  window.observerReviewRows = new Map(visible.map((row) => [String(row.id), row]));

  a.innerHTML =
    h(
      "Reviews",
      "Submit a review, revisit your previous reviews, or browse reviews written by others about residents assigned to you.",
    ) +
    `<section class="card review-workspace">
      <div class="review-workspace-tabs" role="tablist" aria-label="Review workspace">
        <button type="button" class="review-workspace-tab active" data-review-section="submit"><span>Submit a review</span><small>Write new</small></button>
        <button type="button" class="review-workspace-tab" data-review-section="mine"><span>My previous reviews</span><small>${mine.length}</small></button>
        <button type="button" class="review-workspace-tab" data-review-section="assigned"><span>Others' reviews on assigned residents</span><small>${others.length}</small></button>
      </div>

      <div class="review-workspace-panel" data-review-panel="submit">
        <div class="review-section-heading"><div><span class="eyebrow">Submit a review</span><h2>Record a clinical or behavioural observation</h2><p>Choose a resident, record a clinical or behavioural observation, then mark it as positive or developmental. You may publish it with your name or anonymously.</p></div></div>
        <div class="form-grid compact-form-grid">
          <label>Search resident<input id="findResident" placeholder="Name or username"></label>
          <label>Residency year<select id="findYear"><option value="">All years</option>${n.map((year) => `<option>${year}</option>`).join("")}</select></label>
        </div>
        <div id="results" class="top-gap">${v("Loading residents…")}</div>
      </div>

      <div class="review-workspace-panel" data-review-panel="mine" hidden>
        <div class="review-section-heading"><div><span class="eyebrow">My previous reviews</span><h2>Reviews written by you</h2><p>Your prior reviews and any reconsideration requests are kept here.</p></div><span class="tag">${mine.length}</span></div>
        ${mineHtml}
      </div>

      <div class="review-workspace-panel" data-review-panel="assigned" hidden>
        <div class="review-section-heading"><div><span class="eyebrow">Assigned residents</span><h2>Reviews written by others</h2><p>Only reviews about residents within your assigned cohorts are shown. Anonymous reviewer identity remains hidden.</p></div><span class="tag">${others.length}</span></div>
        ${othersHtml}
      </div>
    </section>`;
  await R();
}





async function getExportableCurriculumChapters() {
  if (!s.p) return [];
  if (s.p.role === "owner") {
    return u(await e.from("chapters").select("id,title,description,year_from,year_to,is_active,sort_order").order("year_from").order("sort_order")) || [];
  }
  const active = u(await e.from("chapters").select("id,title,description,year_from,year_to,is_active,sort_order").eq("is_active", true).order("year_from").order("sort_order")) || [];
  if (s.p.role === "resident") {
    const year = Number(s.p.residency_year || 1);
    return active.filter((chapter) => Number(chapter.year_from || 1) <= year);
  }
  if (s.p.role === "assessor") {
    const years = u(await e.from("assessor_year_assignments").select("residency_year").eq("assessor_id", s.p.id).eq("is_active", true)) || [];
    const assigned = new Set(years.map((row) => Number(row.residency_year)));
    return active.filter((chapter) => [...assigned].some((year) => Number(chapter.year_from || year) <= year && Number(chapter.year_to || chapter.year_from || year) >= year));
  }
  return active;
}
async function openCurriculumExport() {
  const chapters = await getExportableCurriculumChapters();
  const owner = s.p.role === "owner";
  const scopeLabel = owner ? "Program curriculum" : s.p.role === "resident" ? "My curriculum" : s.p.role === "assessor" ? "Assigned curriculum" : "Training curriculum";
  y(`<form id="curriculumExportForm" class="modal curriculum-export-modal"><div class="modal-head"><div><span class="eyebrow">PDF export</span><h2>Export curriculum</h2><p>${o(scopeLabel)}</p></div><button type="button" data-close>×</button></div>
    <p>Choose all available chapters or select only the chapters you want in this PDF.</p>
    <div class="curriculum-export-tools">${owner ? '<button type="button" class="btn small secondary" data-curriculum-export-select="active">Select all active</button><button type="button" class="btn small secondary" data-curriculum-export-select="all">Select all chapters</button>' : '<button type="button" class="btn small secondary" data-curriculum-export-select="all">Select all</button>'}<button type="button" class="btn small secondary" data-curriculum-export-select="none">Clear</button></div>
    <div class="curriculum-export-list">${chapters.map((chapter) => `<label class="curriculum-export-row" data-active="${chapter.is_active ? "true" : "false"}"><input type="checkbox" name="chapter_ids" value="${chapter.id}" ${chapter.is_active ? "checked" : ""}><span><b>${o(chapter.title)}</b><small>Year ${chapter.year_from}${chapter.year_to > chapter.year_from ? `–${chapter.year_to}` : ""}${owner && !chapter.is_active ? " · Inactive chapter" : ""}</small></span></label>`).join("") || '<div class="panel-empty">No chapters are available in your curriculum scope.</div>'}</div>
    <div class="actions"><button type="button" class="btn secondary" data-close>Cancel</button><button>Export selected chapters</button></div></form>`);
}
async function printCurriculumPdf(chapterIds) {
  const allowed = await getExportableCurriculumChapters();
  const allowedIds = new Set(allowed.map((chapter) => Number(chapter.id)));
  const ids = chapterIds.map(Number).filter((id) => id && allowedIds.has(id));
  if (!ids.length) return alert("Choose at least one chapter from your available curriculum.");
  const popup = window.open("", "_blank");
  if (!popup) return alert("Please allow pop-ups to export the PDF.");
  popup.opener = null;
  popup.document.write('<!doctype html><html><body style="font-family:Arial,sans-serif;padding:30px">Preparing curriculum…</body></html>');
  popup.document.close();
  try {
    const [chapters, knowledge, skills] = await Promise.all([
      e.from("chapters").select("*").in("id", ids).order("year_from").order("sort_order"),
      e.from("knowledge_items").select("*").in("chapter_id", ids).eq("is_active", true).order("sort_order"),
      e.from("skills").select("*").in("chapter_id", ids).eq("is_active", true).order("sort_order"),
    ]).then((results) => results.map(u));
    const sections = chapters.map((chapter) => {
      const k = knowledge.filter((item) => Number(item.chapter_id) === Number(chapter.id));
      const sk = skills.filter((item) => Number(item.chapter_id) === Number(chapter.id));
      return `<section class="chapter-pdf"><div class="chapter-pdf-head"><div><span>Year ${chapter.year_from}${chapter.year_to > chapter.year_from ? `–${chapter.year_to}` : ""}</span><h2>${o(chapter.title)}</h2>${chapter.description ? `<p>${o(chapter.description)}</p>` : ""}</div><b>${k.length} knowledge · ${sk.length} skills</b></div>
        <h3>Knowledge</h3>${k.length ? `<table><thead><tr><th>No.</th><th>Knowledge point</th><th>Description</th></tr></thead><tbody>${k.map((item, index) => `<tr><td>${index + 1}</td><td><b>${o(item.title)}</b></td><td>${o(item.description || "—")}</td></tr>`).join("")}</tbody></table>` : '<p class="empty">No active knowledge points.</p>'}
        <h3>Skills</h3>${sk.length ? `<table><thead><tr><th>No.</th><th>Skill</th><th>Description</th><th>Expected level</th></tr></thead><tbody>${sk.map((item, index) => `<tr><td>${index + 1}</td><td><b>${o(item.title)}</b></td><td>${o(item.description || "—")}</td><td>Level ${o(item.expected_level || "—")}</td></tr>`).join("")}</tbody></table>` : '<p class="empty">No active skills.</p>'}
      </section>`;
    }).join("");
    const personLabel = s.p.role === "resident" ? ` · ${o(s.p.display_name || s.p.username || "Resident")}` : "";
    popup.document.open();
    popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Training Curriculum</title><style>
      @page{size:A4 portrait;margin:12mm}*{box-sizing:border-box}body{margin:0;color:#142033;font-family:Arial,sans-serif;font-size:10px}header{display:flex;justify-content:space-between;align-items:end;padding-bottom:8px;margin-bottom:14px;border-bottom:2px solid #123b63}header h1{margin:0;color:#081c35;font-size:20px}header p{margin:3px 0 0;color:#64748b}.chapter-pdf{margin:0 0 18px;break-inside:auto}.chapter-pdf+.chapter-pdf{padding-top:14px;border-top:1px solid #cbd5e1}.chapter-pdf-head{display:flex;justify-content:space-between;gap:15px;align-items:start}.chapter-pdf-head span{font-size:8px;font-weight:700;text-transform:uppercase;color:#1670d2}.chapter-pdf-head h2{margin:3px 0 2px;font-size:16px}.chapter-pdf-head p{margin:0;color:#64748b;line-height:1.4}.chapter-pdf-head>b{white-space:nowrap;color:#475569}h3{margin:12px 0 5px;font-size:11px;color:#0d2d50}table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{border:1px solid #b8c5d2;padding:5px 6px;vertical-align:top;overflow-wrap:anywhere}th{background:#0d4963;color:#fff;font-size:8px;text-transform:uppercase}th:first-child,td:first-child{width:7%;text-align:center}table:nth-of-type(2) th:last-child,table:nth-of-type(2) td:last-child{width:14%;text-align:center}.empty{padding:8px;border:1px dashed #cbd5e1;color:#64748b}footer{margin-top:10px;text-align:right;color:#64748b;font-size:8px}</style></head><body><header><div><h1>Cardiology Training Curriculum</h1><p>${chapters.length} selected chapter${chapters.length === 1 ? "" : "s"}${personLabel}</p></div><p>Generated ${d(new Date().toISOString())}</p></header>${sections}<footer>Training & Assessment Portal</footer></body></html>`);
    popup.document.close();
    popup.focus();
    setTimeout(() => popup.print(), 300);
  } catch (error) {
    popup.close();
    throw error;
  }
}

function normalizeBulkText(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}
function splitBulkCurriculumLine(line) {
  const delimiter = line.includes("\t") ? "\t" : "|";
  return line.split(delimiter).map((part) => part.trim());
}
async function openBulkCurriculumPaste(kind = "", chapterId = "") {
  if (s.p.role !== "owner") return;
  const chapters = u(await e.from("chapters").select("id,title,year_from,year_to,sort_order").order("year_from").order("sort_order")) || [];
  const chapter = chapterId ? chapters.find((item) => String(item.id) === String(chapterId)) : null;
  const currentMode = Boolean(chapter && ["knowledge", "skill"].includes(kind));
  const kindLabel = kind === "skill" ? "skills" : "knowledge points";
  const simpleExample = kind === "skill"
    ? `Temporary pacemaker insertion | Perform temporary pacing safely under supervision | 3\nPericardiocentesis | Demonstrate safe emergency pericardiocentesis | 2`
    : `Initial assessment of ACS | Recognize ACS presentations and initiate guideline-directed assessment\nCardiac arrest | Identify reversible causes and immediate priorities`;
  const allExample = `Acute Cardiac Care | Knowledge | Initial assessment of ACS | Recognize ACS presentations and immediate priorities\nAcute Cardiac Care | Skill | Temporary pacemaker insertion | Perform temporary pacing safely | 3\nCoronary Artery Disease | Knowledge | Secondary prevention | Apply evidence-based secondary prevention`;
  y(`<form id="bulkCurriculumForm" class="modal bulk-curriculum-modal">
    <div class="modal-head"><div><span class="eyebrow">Owner bulk editor</span><h2>${currentMode ? `Bulk add ${kindLabel}` : "Bulk add curriculum across chapters"}</h2></div><button type="button" data-close>×</button></div>
    <div class="bulk-format-card">
      ${currentMode
        ? `<b>${o(chapter.title)}</b><p>Paste one item per line. Use a TAB or <code>|</code> between columns.</p><code>${kind === "skill" ? "Title | Description | Expected level (1–5)" : "Title | Description"}</code>`
        : `<b>All chapters at once</b><p>Paste one item per line. Chapter can be its exact title or numeric chapter ID. Type accepts Knowledge/K or Skill/S.</p><code>Chapter | Type | Title | Description | Level</code>`}
    </div>
    <label class="full">Paste items
      <textarea name="bulk_text" class="bulk-paste-area" required placeholder="${o(currentMode ? simpleExample : allExample)}"></textarea>
    </label>
    ${currentMode && kind === "skill" ? `<label>Default expected level<select name="default_level">${n.map((level) => `<option value="${level}" ${level === 3 ? "selected" : ""}>Level ${level}</option>`).join("")}</select><small class="date-format-hint">Used when a pasted row has no third column.</small></label>` : ""}
    <label class="check-row"><input name="skip_duplicates" type="checkbox" checked> Skip exact duplicate titles already present in the same chapter</label>
    <input type="hidden" name="bulk_kind" value="${o(kind)}">
    <input type="hidden" name="bulk_chapter_id" value="${o(chapterId)}">
    <div class="bulk-example"><b>Example</b><pre>${o(currentMode ? simpleExample : allExample)}</pre></div>
    <div class="actions"><button type="button" class="btn secondary" data-close>Cancel</button><button>Import pasted items</button></div>
  </form>`);
}
function parseBulkCurriculumRows(text, chapters, fixedKind = "", fixedChapterId = "", defaultLevel = 3) {
  const byId = new Map(chapters.map((chapter) => [String(chapter.id), chapter]));
  const byTitle = new Map(chapters.map((chapter) => [normalizeBulkText(chapter.title), chapter]));
  const rows = [];
  const errors = [];
  String(text || "").split(/\r?\n/).forEach((raw, index) => {
    const line = raw.trim();
    if (!line || line.startsWith("#")) return;
    const parts = splitBulkCurriculumLine(line);
    let chapter, kind, title, description, expectedLevel;
    if (fixedChapterId && fixedKind) {
      chapter = byId.get(String(fixedChapterId));
      kind = fixedKind;
      title = parts[0] || "";
      description = parts[1] || "";
      expectedLevel = kind === "skill" ? Number(parts[2] || defaultLevel) : null;
    } else {
      const chapterToken = parts[0] || "";
      chapter = byId.get(chapterToken) || byTitle.get(normalizeBulkText(chapterToken));
      const typeToken = normalizeBulkText(parts[1]);
      kind = ["knowledge", "k", "knowledge point", "knowledge points"].includes(typeToken)
        ? "knowledge"
        : ["skill", "skills", "s"].includes(typeToken)
          ? "skill"
          : "";
      title = parts[2] || "";
      description = parts[3] || "";
      expectedLevel = kind === "skill" ? Number(parts[4] || defaultLevel) : null;
    }
    if (!chapter) errors.push(`Line ${index + 1}: chapter not found.`);
    else if (!kind) errors.push(`Line ${index + 1}: type must be Knowledge or Skill.`);
    else if (!title) errors.push(`Line ${index + 1}: title is missing.`);
    else if (kind === "skill" && (!Number.isFinite(expectedLevel) || expectedLevel < 1 || expectedLevel > 5)) errors.push(`Line ${index + 1}: skill level must be 1–5.`);
    else rows.push({ chapter_id: Number(chapter.id), chapter_title: chapter.title, kind, title: title.slice(0, 180), description: description.slice(0, 1200), expected_level: kind === "skill" ? expectedLevel : null });
  });
  return { rows, errors };
}
function openGuidelineGenerator(chapterId) {
  const chapter = s.curriculumChapter;
  if (!chapter || String(chapter.id) !== String(chapterId)) {
    return alert("Open the chapter again before using AI generation.");
  }
  y(`<form id="guidelineAiForm" class="modal ai-guideline-modal">
    <div class="modal-head">
      <div><span class="eyebrow">Owner AI tool</span><h2>Generate curriculum from European guideline</h2></div>
      <button type="button" data-close>×</button>
    </div>
    <p class="form-note">Chapter: <b>${o(chapter.title)}</b>. Upload the European guideline PDF. AI will create a draft of assessment-oriented knowledge points and practical skills. You review the draft before anything is saved.</p>
    <div class="form-grid">
      <label class="full">European guideline PDF
        <input name="guideline" type="file" accept="application/pdf,.pdf" required>
        <small class="date-format-hint">PDF only · maximum 10 MB</small>
      </label>
      <label>Knowledge points requested
        <input name="knowledge_count" type="number" min="1" max="30" value="10" required>
      </label>
      <label>Skills requested
        <input name="skills_count" type="number" min="1" max="25" value="8" required>
      </label>
      <label class="full">Extra instructions
        <textarea name="instructions" maxlength="2000" placeholder="Optional: emphasize assessment competencies, entrustable clinical activities, procedural independence, acute care, etc."></textarea>
      </label>
    </div>
    <input type="hidden" name="chapter_id" value="${o(chapter.id)}">
    <div class="actions"><button type="button" class="btn secondary" data-close>Cancel</button><button class="btn ai-btn">Generate draft</button></div>
  </form>`);
}

function readGuidelineFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the guideline PDF."));
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(file);
  });
}

function renderAiCurriculumDraft(chapterId, draft) {
  const knowledge = Array.isArray(draft?.knowledge) ? draft.knowledge : [];
  const skills = Array.isArray(draft?.skills) ? draft.skills : [];
  s.aiCurriculumDraft = { chapterId: String(chapterId), knowledge, skills, summary: draft?.summary || "", warnings: draft?.warnings || [] };
  const warningText = Array.isArray(draft?.warnings) && draft.warnings.length
    ? `<div class="ai-warning"><b>AI cautions</b><ul>${draft.warnings.map((item) => `<li>${o(item)}</li>`).join("")}</ul></div>`
    : "";
  y(`<form id="aiCurriculumImportForm" class="modal ai-draft-modal">
    <div class="modal-head">
      <div><span class="eyebrow">AI draft · review before import</span><h2>${o(s.curriculumChapter?.title || "Curriculum")}</h2></div>
      <button type="button" data-close>×</button>
    </div>
    ${draft?.summary ? `<p class="ai-summary">${o(draft.summary)}</p>` : ""}
    ${warningText}
    <div class="ai-draft-columns">
      <section>
        <div class="section-head"><div><h3>Knowledge</h3><p>${knowledge.length} suggestions</p></div><label class="bulk-check"><input type="checkbox" data-ai-select-all="knowledge" checked> Select all</label></div>
        <div class="ai-draft-list">${knowledge.map((item, index) => `
          <label class="ai-draft-item">
            <input type="checkbox" name="knowledge_indices" value="${index}" checked>
            <span><b>${o(item.title)}</b><small>${o(item.description || "")}</small>${item.source_basis ? `<em>Guideline basis: ${o(item.source_basis)}</em>` : ""}</span>
          </label>`).join("") || '<p class="muted">No knowledge points were generated.</p>'}</div>
      </section>
      <section>
        <div class="section-head"><div><h3>Skills</h3><p>${skills.length} suggestions</p></div><label class="bulk-check"><input type="checkbox" data-ai-select-all="skills" checked> Select all</label></div>
        <div class="ai-draft-list">${skills.map((item, index) => `
          <label class="ai-draft-item">
            <input type="checkbox" name="skill_indices" value="${index}" checked>
            <span><b>${o(item.title)}</b><small>${o(item.description || "")}</small><span class="tag">Expected level ${Number(item.expected_level) || 1}</span>${item.source_basis ? `<em>Guideline basis: ${o(item.source_basis)}</em>` : ""}</span>
          </label>`).join("") || '<p class="muted">No skills were generated.</p>'}</div>
      </section>
    </div>
    <input type="hidden" name="chapter_id" value="${o(chapterId)}">
    <div class="actions"><button type="button" class="btn secondary" data-close>Discard draft</button><button class="btn success-button">Import selected items</button></div>
  </form>`);
}

function privateMessageCategory(message) {
  const subject = String(message?.subject || "").trim().toLowerCase();
  const text = `${subject} ${message?.body || ""}`.toLowerCase();
  if (subject === "reconsideration rejected" || subject.startsWith("logbook entry rejected")) return "rejected";
  if (subject === "reconsideration approved" || subject.startsWith("logbook entry approved")) return "approved_updates";
  if (text.includes("request to reconsider") && !subject.startsWith("reconsideration ")) return "reconsideration";
  if (subject === "logbook rejection" || (subject === "logbook review update" && /\brejected\b/.test(text))) return "rejected";
  if (subject === "logbook approval" || subject === "logbook review update") return "approved_updates";
  return "normal";
}

function isReconsiderationRequest(message) {
  const text = `${message?.subject || ""} ${message?.body || ""}`.toLowerCase();
  return text.includes("request to reconsider") &&
    !text.includes("reconsideration approved") &&
    !text.includes("reconsideration rejected");
}

function filterPrivateMessageRows() {
  const query = (t("#messageSearch")?.value || "").trim().toLowerCase();
  const category = t("#messageCategoryFilter")?.value || "";
  const activePanel = document.querySelector('[data-mail-panel]:not([hidden])');
  let visible = 0;
  activePanel?.querySelectorAll(".message-row").forEach((row) => {
    const match =
      (!query || (row.dataset.messageSearch || "").includes(query)) &&
      (!category || row.dataset.messageCategory === category);
    row.hidden = !match;
    if (match) visible += 1;
  });
  const empty = t("#messageSearchEmpty");
  if (empty) empty.hidden = visible > 0;
  const selectVisible = t("#selectVisibleMessages");
  if (selectVisible) {
    const checkboxes = [...(activePanel?.querySelectorAll(".message-row:not([hidden]) .message-select") || [])];
    selectVisible.checked = Boolean(checkboxes.length) && checkboxes.every((box) => box.checked);
    selectVisible.indeterminate = checkboxes.some((box) => box.checked) && !selectVisible.checked;
  }
}

function reviewThreadActions(review) {
  if (!review) return "";
  const id = String(review.review_id || review.id || "");
  const residentOwnReview = s.p.role === "resident" && String(review.resident_id) === String(s.p.id);
  const reconsideration = String(review.reconsideration_status || "none");
  const openLabel = residentOwnReview ? "Open review" : "View review";
  const openTarget = s.p.role === "resident" ? "reviews" : s.p.role === "assessor" ? "write-review" : s.p.role === "owner" ? "comments" : "reviews";
  return `<div class="message-actions review-message-actions thread-review-actions">
    <button class="btn small secondary" data-open-review-notification="${o(id)}" data-review-target="${o(openTarget)}">${openLabel}</button>
    ${residentOwnReview && reconsideration === "none" ? `<button class="btn small reclaim-button" data-review-reconsider="${o(id)}">Request to reconsider</button>` : ""}
    ${residentOwnReview && reconsideration === "requested" ? '<span class="tag warning">Reconsideration pending</span>' : ""}
    ${residentOwnReview && reconsideration === "accepted" ? '<span class="tag success">Modified</span>' : ""}
    ${residentOwnReview && reconsideration === "upheld" ? '<span class="tag neutral">Original upheld</span>' : ""}
  </div>`;
}

function buildReviewInboxThreads(items, reviewActionMap) {
  const groups = new Map();
  const output = [];
  items.forEach((message) => {
    const review = reviewActionMap.get(String(message.id));
    if (!review) {
      output.push({ type: "message", message });
      return;
    }
    const key = String(review.review_id);
    let group = groups.get(key);
    if (!group) {
      group = { type: "review-thread", reviewId: key, review, messages: [] };
      groups.set(key, group);
      output.push(group);
    }
    group.messages.push(message);
    if (new Date(message.created_at || 0) >= new Date(group.messages[0]?.created_at || 0)) group.review = review;
  });
  output.forEach((entry) => {
    if (entry.type === "review-thread") entry.messages.sort((a,b) => new Date(a.created_at) - new Date(b.created_at));
  });
  output.sort((a,b) => {
    const ad = a.type === "review-thread" ? a.messages[a.messages.length-1]?.created_at : a.message?.created_at;
    const bd = b.type === "review-thread" ? b.messages[b.messages.length-1]?.created_at : b.message?.created_at;
    return new Date(bd || 0) - new Date(ad || 0);
  });
  return output;
}

function renderReviewThreadTimeline(thread) {
  const review = thread.review || {};
  const domain = String(review.category || "").toLowerCase() === "attitude" ? "Behavioural" : "Clinical";
  const type = String(review.sentiment || "positive").toLowerCase() === "negative" ? "Negative" : "Positive";
  const currentUserId = String(s.p?.id || "");
  const timeline = thread.messages.map((message) => {
    const linked = window.inboxReviewActions?.get(String(message.id));
    const purpose = String(linked?.purpose || "");
    const mine = String(message.sender_id || "") === currentUserId;
    let compactText = String(message.body || "").trim();
    if (purpose === "reconsideration_requested" && linked?.reconsideration_text) compactText = linked.reconsideration_text;
    if ((purpose === "resident_resolution" || purpose === "owner_resolution" || purpose === "assessor_resolution") && linked?.reconsideration_status === "accepted") {
      compactText = `Modified review: ${linked.comment || review.comment || ""}`;
    }
    if (!compactText && linked?.comment) compactText = linked.comment;
    const subject = String(message.subject || "Review update")
      .replace(/resident review/ig, "Review")
      .replace(/review reconsideration requested/ig, "Reconsideration requested");
    return `<div class="review-chat-line ${mine ? "mine" : "theirs"} ${message.is_read ? "read" : "unread"}">
      <div class="review-chat-bubble">
        <div class="review-chat-meta"><b>${o(message.sender_name || (mine ? "You" : "System"))}</b><small>${l(message.created_at)}</small></div>
        <span class="review-chat-subject">${o(subject)}</span>
        <p>${o(compactText || "Review update").replace(/\n/g, "<br>")}</p>
      </div>
    </div>`;
  }).join("");
  const currentStatus = review.reconsideration_status === "accepted"
    ? "💡 Modified"
    : review.reconsideration_status === "requested"
      ? "Reconsideration pending"
      : review.reconsideration_status === "upheld"
        ? "Original upheld"
        : "";
  return `<article class="modal message-view review-thread-modal">
    <div class="modal-head review-thread-head">
      <div><span class="eyebrow">Review thread</span><h2>${o(review.resident_name || "Resident review")}</h2><small>${o(domain)} · ${o(type)}${currentStatus ? ` · ${o(currentStatus)}` : ""}</small></div>
      <button type="button" data-close aria-label="Close">×</button>
    </div>
    ${review.comment ? `<div class="review-thread-current-compact"><span>Current review</span><b>${o(review.comment)}</b></div>` : ""}
    <div class="review-thread-chat" aria-label="Review conversation">${timeline}</div>
    ${reviewThreadActions(review)}
  </article>`;
}

function syncPrivateMailboxControls() {
  const box = document.querySelector('[data-mail-panel]:not([hidden])')?.dataset.mailPanel || "inbox";
  document.querySelectorAll("[data-inbox-only]").forEach((element) => {
    element.hidden = box !== "inbox";
  });
  document.querySelectorAll("[data-live-mail-only]").forEach((element) => {
    element.hidden = !["inbox", "sent"].includes(box);
  });
}

async function inboxPage() {
  t("#title").textContent = "Inbox";
  a.classList.add("mail-content");
  const [inboxResult, sentResult, trashResult, reviewActionResult] = await Promise.all([
    e.rpc("get_private_messages", { p_box: "inbox" }),
    e.rpc("get_private_messages", { p_box: "sent" }),
    e.rpc("get_private_messages", { p_box: "trash" }),
    e.rpc("get_my_review_message_actions_v1051"),
  ]);
  const inbox = u(inboxResult) || [];
  const sent = u(sentResult) || [];
  const trash = u(trashResult) || [];
  const reviewActions = u(reviewActionResult) || [];
  const reviewActionMap = new Map(reviewActions.map((row) => [String(row.message_id), row]));
  window.inboxReviewActions = reviewActionMap;
  window.observerReviewRows ||= new Map();
  reviewActions.forEach((row) => window.observerReviewRows.set(String(row.review_id), { ...row, id: row.review_id }));
  const statusTitle = (message) => {
    const subject = String(message.subject || "No subject").replace(/\bReclaim\b/gi, "Request to reconsider");
    if (message.subject === "Logbook approval" || subject === "Reconsideration approved")
      return `<span class="decision-title"><span class="decision-icon approved" aria-label="Approved">✓</span><span>${o(subject)}</span></span>`;
    if (message.subject === "Logbook rejection" || subject === "Reconsideration rejected")
      return `<span class="decision-title"><span class="decision-icon rejected" aria-label="Rejected">×</span><span>${o(subject)}</span></span>`;
    if (isReconsiderationRequest(message))
      return `<span class="decision-title"><span class="decision-icon reconsider" aria-label="Reconsideration">↺</span><span>Request to reconsider</span></span>`;
    return o(subject);
  };
  const approvalButtons = (message) =>
    message.logbook_entry_id && !message.logbook_action_taken && !isReconsiderationRequest(message)
      ? `<div class="message-actions approval-actions"><button class="btn small success-button" data-quick-logbook-approve="${message.logbook_entry_id}" data-approval-message-id="${message.id}">Approve</button><button class="btn small danger-button" data-inbox-logbook-reject="${message.logbook_entry_id}" data-approval-message-id="${message.id}" data-logbook-title="${o(message.logbook_title || "Logbook activity")}">Reject</button></div>`
      : "";
  const reviewButtons = (message, box) => box === "inbox" ? reviewThreadActions(reviewActionMap.get(String(message.id))) : "";
  const inboxEntries = buildReviewInboxThreads(inbox, reviewActionMap);
  window.reviewInboxThreads = new Map(inboxEntries.filter((entry) => entry.type === "review-thread").map((entry) => [String(entry.reviewId), entry]));
  const rows = (items, box) => {
    const entries = box === "inbox" ? inboxEntries : items.map((message) => ({ type: "message", message }));
    return entries.length
      ? entries.map((entry) => {
          if (entry.type === "review-thread") {
            const latest = entry.messages[entry.messages.length - 1];
            const unread = entry.messages.some((message) => !message.is_read);
            const ids = entry.messages.map((message) => message.id).join(",");
            const review = entry.review || {};
            const status = review.reconsideration_status === "accepted" ? "💡 Modified" : review.reconsideration_status === "requested" ? "Reconsideration pending" : review.reconsideration_status === "upheld" ? "Original upheld" : `${entry.messages.length} update${entry.messages.length === 1 ? "" : "s"}`;
            return `<article class="message-row review-thread-row ${unread ? "unread" : "read"}"
              data-message-category="${review.reconsideration_status === "requested" ? "reconsideration" : review.reconsideration_status === "accepted" || review.reconsideration_status === "upheld" ? "approved_updates" : "normal"}"
              data-message-search="${o(`${review.resident_name || ""} ${review.comment || ""} ${entry.messages.map((m) => `${m.sender_name || ""} ${m.subject || ""} ${m.body || ""}`).join(" ")}`.toLowerCase())}">
              <input class="message-select" type="checkbox" value="${latest.id}" data-message-ids="${o(ids)}" aria-label="Select review conversation">
              <button class="message-open" data-review-thread="${o(entry.reviewId)}">
                <span class="message-person"><span class="message-direction">Review</span>${o(review.resident_name || latest.sender_name || "Resident")}</span>
                <span class="message-subject"><span class="decision-title"><span class="decision-icon reconsider" aria-hidden="true">↗</span><span>Review conversation</span></span><small class="thread-preview">${o(review.comment || latest.subject || "Review update")}</small></span>
                <small>${l(latest.created_at)}</small>
              </button>
              <div class="message-actions review-thread-row-actions"><span class="tag ${review.reconsideration_status === "accepted" ? "success" : review.reconsideration_status === "requested" ? "warning" : "neutral"}">${o(status)}</span><button class="btn small secondary" data-review-thread="${o(entry.reviewId)}">Open thread</button></div>
            </article>`;
          }
          const message = entry.message;
          const category = privateMessageCategory(message);
          return `<article class="message-row ${box === "inbox" ? (message.is_read ? "read" : "unread") : "sent-message"}"
            data-message-category="${category}"
            data-message-search="${o(`${box === "inbox" ? message.sender_name : message.receiver_name} ${message.subject || ""} ${message.body || ""}`.toLowerCase())}">
            <input class="message-select" type="checkbox" value="${message.id}" aria-label="Select message">
            <button class="message-open" data-message-id="${message.id}" data-message-box="${box}">
              <span class="message-person"><span class="message-direction">${box === "inbox" ? "From" : "To"}</span>${o(box === "inbox" ? message.sender_name : message.receiver_name)}</span>
              <span class="message-subject">${statusTitle(message)}${category === "reconsideration" ? '<span class="tag warning">Decision needed</span>' : ""}</span>
              <small>${l(message.created_at)}</small>
            </button>
            ${box === "inbox" ? `${approvalButtons(message)}${reviewButtons(message, box)}` : ""}
          </article>`;
        }).join("")
      : '<div class="mail-empty">No messages here.</div>';
  };

  window.residentMessages = new Map([
    ...inbox.map((message) => [String(message.id), message]),
    ...sent.map((message) => [`sent-${message.id}`, message]),
    ...trash.map((message) => [`trash-${message.id}`, message]),
  ]);
  window.logbookInboxButtons = approvalButtons;

  a.innerHTML =
    h(
      "Private messages",
      "Search, filter, select and clean messages without deleting resident logbook evidence.",
      '<button class="btn" data-compose-message>New message</button>',
    ) +
    `
    <section class="card mailbox wide-mailbox">
      <div class="mailbox-tabs" role="tablist">
        <button class="mailbox-tab active" data-mail-tab="inbox">Inbox <span class="nav-badge inline-badge" ${countUnreadInboxThreads(inbox, reviewActions) ? "" : "hidden"}>${countUnreadInboxThreads(inbox, reviewActions)}</span></button>
        <button class="mailbox-tab" data-mail-tab="sent">Sent <span class="tag">${sent.length}</span></button>
        <button class="mailbox-tab" data-mail-tab="trash">Trash <span class="tag">${trash.length}</span></button>
      </div>
      <div class="mail-safety-note"><b>Safe cleanup:</b> deleting Inbox/Sent messages does not delete <b>My logbook</b> entries or exported resident logbook data.</div>
      <div class="mail-tools mail-tools-enhanced">
        <div class="mail-filter-group">
          <input id="messageSearch" type="search" placeholder="Search by any word">
          <select id="messageCategoryFilter" aria-label="Filter message category">
            <option value="">All message types</option>
            <option value="approved_updates">Approved / updates</option>
            <option value="normal">Normal inbox</option>
            <option value="rejected">Rejected</option>
            <option value="reconsideration">Requests to reconsider</option>
          </select>
        </div>
        <div class="mail-bulk-actions">
          <label class="bulk-check"><input id="selectVisibleMessages" type="checkbox"> Select visible</label>
          <button class="btn secondary" data-mark-all-read data-inbox-only ${inbox.some((item) => !item.is_read) ? "" : "disabled"}>Mark all read</button>
          <button class="btn danger" data-trash-selected data-live-mail-only>Delete selected</button>
        </div>
      </div>
      <div class="mail-panel" data-mail-panel="inbox"><div class="message-list">${rows(inbox, "inbox")}</div></div>
      <div class="mail-panel" data-mail-panel="sent" hidden><div class="message-list">${rows(sent, "sent")}</div></div>
      <div class="mail-panel" data-mail-panel="trash" hidden><div class="trash-tools"><button class="btn secondary" data-restore-selected>Restore selected</button><button class="btn danger" data-delete-forever>Delete selected forever</button><button class="btn danger" data-empty-trash>Empty Trash</button></div><div class="message-list">${rows(trash, "trash")}</div></div>
      <div id="messageSearchEmpty" class="mail-empty" hidden>No messages match your current filter.</div>
    </section>`;
  filterPrivateMessageRows();
  syncPrivateMailboxControls();
}

async function ownerMessageCleanupPage() {
  if (s.p.role !== "owner") return g("dashboard");
  t("#title").textContent = "Message cleanup";
  const summary = u(await e.rpc("owner_message_cleanup_summary")) || [];
  const counts = new Map(summary.map((row) => [String(row.category), Number(row.message_count) || 0]));
  const total = counts.get("all") || 0;
  const categories = [
    ["approved_updates", "Approved & updates", "Completed approvals and status/update notifications."],
    ["normal", "Normal inbox", "Ordinary messages and other non-final message traffic."],
    ["rejected", "Rejected", "Rejected logbook and reconsideration result messages."],
    ["reconsideration", "Requests to reconsider", "Active reconsideration message copies. Delete only if you intentionally want to clear them."],
  ];
  a.innerHTML =
    h(
      "Message cleanup",
      "Choose message categories instead of selecting residents one by one. This deletes message records only; resident My logbook evidence remains protected.",
    ) +
    `<section class="card cleanup-manager">
      <div class="cleanup-summary">
        <div><span class="eyebrow">Program messages</span><strong>${total}</strong><small>Total message records currently stored</small></div>
        <label class="bulk-check cleanup-select-all"><input id="cleanupSelectAll" type="checkbox"> Select all categories</label>
      </div>
      <form id="ownerMessageCleanupForm">
        <div class="cleanup-category-grid">
          ${categories.map(([value, title, description]) => `
            <label class="cleanup-category-card">
              <input type="checkbox" name="categories" value="${value}">
              <span class="cleanup-category-copy"><b>${o(title)}</b><small>${o(description)}</small></span>
              <strong>${counts.get(value) || 0}</strong>
            </label>`).join("")}
        </div>
        <div class="cleanup-actions">
          <div class="cleanup-protection"><b>My logbook is protected.</b><span>No row from <code>resident_logbook_entries</code> is deleted by these controls, so resident logbook history and PDF export data remain available.</span></div>
          <div class="cleanup-buttons">
            <button class="btn danger" type="submit">Delete selected categories</button>
            <button class="btn danger-button" type="button" data-cleanup-delete-all>Delete ALL messages</button>
          </div>
        </div>
      </form>
    </section>`;
}

async function logbookRequestsPage() {
  t("#title").textContent = "Logbook requests";
  a.classList.add("mail-content");
  const [receivedResult, sentResult, updatesResult, trashResult, hiddenResult, reconsiderationResult] = await Promise.all([
    e.rpc("get_logbook_messages", { p_view: "received" }),
    e.rpc("get_logbook_messages", { p_view: "sent" }),
    e.rpc("get_logbook_messages", { p_view: "updates" }),
    e.rpc("get_logbook_messages", { p_view: "trash" }),
    e.rpc("get_hidden_logbook_message_ids"),
    e.rpc("get_my_logbook_reconsiderations_v1044"),
  ]);
  const hiddenIds = new Set((u(hiddenResult) || []).map((row) => String(row.message_id)));
  const keepVisible = (items) => (u(items) || []).filter((message) => !hiddenIds.has(String(message.id)));
  const received = keepVisible(receivedResult),
    sent = keepVisible(sentResult),
    updates = keepVisible(updatesResult),
    trash = keepVisible(trashResult),
    reconsiderations = u(reconsiderationResult) || [];

  window.logbookReconsiderationRows = new Map(reconsiderations.map((row) => [String(row.id), row]));
  const reviewerReconsiderations = reconsiderations
    .filter((row) => String(row.reviewer_id) === String(s.p.id))
    .sort((x, y) => new Date(y.created_at) - new Date(x.created_at));
  const latestReconsiderationByEntry = new Map();
  reviewerReconsiderations.forEach((row) => {
    const key = String(row.entry_id || "");
    if (key && !latestReconsiderationByEntry.has(key)) latestReconsiderationByEntry.set(key, row);
  });

  const juniorResident = s.p.role === "resident" && Number(s.p.residency_year) <= 2;
  const seniorResident = s.p.role === "resident" && Number(s.p.residency_year) >= 3;
  const assessor = s.p.role === "assessor";
  const views = juniorResident
    ? ["updates"]
    : assessor
      ? ["received", "trash"]
      : s.p.role === "observer"
        ? ["received"]
        : seniorResident
          ? ["received", "sent", "updates"]
          : ["received", "sent", "updates"];
  const firstView = views[0];
  const activityLabel = (message) => o(message.logbook_title || "Logbook activity");
  const statusTitle = (message) => message.subject === "Logbook approval"
    ? `<span class="decision-title"><span class="decision-icon approved">✓</span><span>Approved request · ${o(message.sender_name)} approved your ${activityLabel(message)}</span></span>`
    : message.subject === "Logbook rejection"
      ? `<span class="decision-title"><span class="decision-icon rejected">×</span><span>Rejected request · ${o(message.sender_name)} rejected your ${activityLabel(message)}</span></span>`
      : message.subject === "Reconsideration approved"
        ? `<span class="decision-title reconsideration-approved-title"><span class="decision-icon-pair" aria-label="Approved after reconsideration"><span class="decision-icon approved">✓</span><span class="after-reconsideration-badge" title="After reconsideration" aria-hidden="true">💡</span></span><span>Approved after reconsideration · ${o(message.sender_name)} approved your ${activityLabel(message)}</span></span>`
        : message.subject === "Reconsideration rejected"
          ? `<span class="decision-title"><span class="decision-icon rejected">×</span><span>Reconsideration rejected · ${o(message.sender_name)} kept the rejection of your ${activityLabel(message)}</span></span>`
          : `Approval request · ${activityLabel(message)}`;

  const reconsiderationForRequest = (message) => latestReconsiderationByEntry.get(String(message.logbook_entry_id || "")) || null;

  const approvalButtons = (message, rec = null) => {
    if (!message.logbook_action_taken)
      return `<div class="message-actions approval-actions"><button class="btn small success-button" data-quick-logbook-approve="${message.logbook_entry_id}" data-approval-message-id="${message.id}">Approve</button><button class="btn small danger-button" data-inbox-logbook-reject="${message.logbook_entry_id}" data-approval-message-id="${message.id}" data-logbook-title="${activityLabel(message)}">Reject</button></div>`;
    if (rec?.status === "approved") return `<span class="tag success">Decision: Approved after reconsideration</span>`;
    if (rec?.status === "rejected") return `<span class="tag danger">Decision: Rejection upheld</span>`;
    if (rec?.status === "requested") return `<span class="tag danger">Rejected</span>`;
    const current = String(message.request_status || "").toLowerCase();
    const cls = current === "rejected" ? "danger" : current === "approved" ? "success" : "neutral";
    const label = current === "rejected" ? "Rejected" : current === "approved" ? "Approved" : "Completed";
    return `<span class="tag ${cls}">${label}</span>`;
  };

  const reconsiderationPanel = (row) => {
    if (!row) return "";
    const activity = row.activity_title || row.procedure_name || "Logbook activity";
    if (row.status === "requested") {
      return `<section class="embedded-reconsideration pending" data-reconsideration-id="${o(row.id)}">
        <div class="embedded-reconsideration-head">
          <div>
            <span class="eyebrow">Reconsideration requested</span>
            <b>${o(activity)}</b>
            <small>${o(row.resident_name || "Resident")} · ${d(row.activity_date)}</small>
          </div>
          <span class="tag danger embedded-original-decision">Original decision: Rejected</span>
        </div>
        <div class="embedded-reconsideration-body">
          <div class="embedded-reconsideration-reason"><span>Resident's reason</span><p>${o(row.reason || "No reason provided")}</p></div>
          <div class="embedded-reconsideration-decisionbox">
            <label class="embedded-reconsideration-note"><span>Decision note</span><small>Required before Approve or Reject</small><textarea data-reconsideration-note maxlength="3000" required placeholder="Write a short note explaining your decision"></textarea></label>
            <div class="embedded-reconsideration-actions">
              <button class="btn danger-button" data-inline-logbook-reconsideration="${o(row.id)}" data-reconsideration-decision="rejected">Reject</button>
              <button class="btn success-button" data-inline-logbook-reconsideration="${o(row.id)}" data-reconsideration-decision="approved">Approve</button>
            </div>
          </div>
        </div>
      </section>`;
    }
    const approved = row.status === "approved";
    return `<section class="embedded-reconsideration resolved ${approved ? "approved" : "rejected"}">
      <div class="embedded-reconsideration-context"><span class="eyebrow">Reconsideration resolved</span><b>${approved ? "Approved" : "Rejected"}</b><small>${o(activity)} · ${d(row.resolved_at || row.created_at)}</small></div>
      <div class="embedded-reconsideration-reason"><span>Resident's reason</span><p>${o(row.reason || "—")}</p></div>
      <div class="embedded-reconsideration-response"><span>Your note</span><p>${o(row.response_note || "—")}</p></div>
    </section>`;
  };

  const residentReconsiderationFor = (message) => reconsiderations.find((row) =>
    String(row.entry_id) === String(message.logbook_entry_id) &&
    String(row.reviewer_id) === String(message.sender_id) &&
    String(row.resident_id) === String(s.p.id)
  );
  const residentReconsiderationAction = (message, view) => {
    if (view !== "updates" || s.p.role !== "resident" || !message.logbook_entry_id || !(message.can_reclaim || message.request_status === "rejected" || message.subject === "Logbook rejection")) return "";
    const rec = residentReconsiderationFor(message);
    if (rec?.status === "requested") return `<div class="message-actions"><span class="tag warning">Reconsideration pending</span></div>`;
    if (rec?.status === "approved") return `<div class="message-actions"><span class="tag success reconsidered-tag">Reconsideration approved</span></div>`;
    if (rec?.status === "rejected") return `<div class="message-actions"><span class="tag danger">Reconsideration rejected</span></div>`;
    return `<div class="message-actions"><button class="btn small reclaim-button" data-reclaim-logbook="${message.logbook_entry_id}" data-reclaim-reviewer-id="${o(message.sender_id || "")}" data-reclaim-reviewer="${o(message.sender_name)}" data-logbook-title="${activityLabel(message)}">Request to reconsider</button></div>`;
  };

  const rows = (items, view) => items.length ? items.map((message) => {
    const rec = view === "received" ? reconsiderationForRequest(message) : null;
    const residentRec = view === "updates" && s.p.role === "resident" ? residentReconsiderationFor(message) : null;
    const effectiveStatus = rec?.status === "requested" ? "pending" : rec?.status === "approved" ? "approved" : rec?.status === "rejected" ? "rejected" : residentRec?.status === "approved" ? "approved" : residentRec?.status === "rejected" ? "rejected" : (message.request_status || "pending");
    const extraSearch = rec ? `${rec.reason || ""} ${rec.response_note || ""} reconsideration ${rec.status || ""}` : residentRec ? `${residentRec.reason || ""} ${residentRec.response_note || ""} reconsideration ${residentRec.status || ""}` : "";
    const titleMarkup = message.subject === "Logbook rejection" && residentRec?.status === "approved"
      ? `<span class="decision-title reconsideration-approved-title"><span class="decision-icon-pair" aria-label="Approved after reconsideration"><span class="decision-icon approved">✓</span><span class="after-reconsideration-badge" title="After reconsideration" aria-hidden="true">💡</span></span><span>Approved after reconsideration · ${o(message.sender_name)} approved your ${activityLabel(message)}</span></span>`
      : message.subject === "Logbook rejection" && residentRec?.status === "rejected"
        ? `<span class="decision-title"><span class="decision-icon rejected" aria-label="Rejected">×</span><span>Reconsideration rejected · ${o(message.sender_name)} kept the rejection of your ${activityLabel(message)}</span></span>`
        : statusTitle(message);
    return `<article class="message-row ${message.is_read ? "read" : "unread"} ${rec ? "has-embedded-reconsideration" : ""}" data-request-resident="${o(message.resident_id || "")}" data-request-status="${o(effectiveStatus)}" data-request-type="${o(`${message.activity_category || ""}:${message.activity_kind || ""}`)}" data-message-search="${o(`${message.sender_name} ${message.receiver_name} ${message.resident_name || ""} ${message.subject || ""} ${message.body || ""} ${message.logbook_title || ""} ${effectiveStatus} ${extraSearch}`.toLowerCase())}">
      <input class="message-select logbook-message-select" type="checkbox" value="${message.id}" aria-label="Select logbook message">
      <button class="message-open" data-message-id="${message.id}" data-message-box="${view === "sent" ? "logbook-sent" : "logbook"}">
        <span class="message-person">${o(view === "sent" ? `To: ${message.receiver_name}` : `From: ${message.sender_name}`)}</span>
        <strong>${titleMarkup}</strong><small>${l(message.created_at)}</small>
      </button>${view === "received" || view === "trash" ? approvalButtons(message, rec) : ""}${residentReconsiderationAction(message, view)}${view === "received" ? reconsiderationPanel(rec) : ""}
    </article>`;
  }).join("") : '<div class="mail-empty">No logbook items here.</div>';

  const receivedEntryIds = new Set(received.map((message) => String(message.logbook_entry_id || "")).filter(Boolean));
  const orphanReconsiderations = reviewerReconsiderations.filter((row) => row.status === "requested" && !receivedEntryIds.has(String(row.entry_id || "")));
  const orphanRows = orphanReconsiderations.map((row) => `<article class="message-row has-embedded-reconsideration orphan-reconsideration-row" data-request-resident="${o(row.resident_id || "")}" data-request-status="pending" data-request-type="${o(`${row.activity_category || ""}:${row.procedure_name || row.activity_title || ""}`)}" data-message-search="${o(`${row.resident_name || ""} ${row.activity_title || ""} ${row.procedure_name || ""} ${row.reason || ""} reconsideration pending`.toLowerCase())}">
    <div class="orphan-request-context"><span class="message-direction">Original request hidden</span><b>${o(row.resident_name || "Resident")} · ${o(row.activity_title || row.procedure_name || "Logbook activity")}</b><small>The original message is no longer visible, but the reconsideration remains actionable.</small></div>
    ${reconsiderationPanel(row)}
  </article>`).join("");

  window.logbookMessages = new Map([
    ...received.map((message) => [`logbook-${message.id}`, message]),
    ...updates.map((message) => [`logbook-${message.id}`, message]),
    ...sent.map((message) => [`logbook-sent-${message.id}`, message]),
    ...trash.map((message) => [`logbook-${message.id}`, message]),
  ]);
  window.logbookInboxButtons = approvalButtons;
  const allResidentSources = [...received,...sent,...updates,...trash,...reconsiderations.map((r) => ({resident_id:r.resident_id,resident_name:r.resident_name}))];
  const allTypeSources = [...received,...sent,...updates,...trash,...reconsiderations.map((r) => ({activity_category:r.activity_category,activity_kind:r.procedure_name || r.activity_title}))];
  const pendingReconsiderationCount = reviewerReconsiderations.filter((item) => item.status === "requested").length;
  const requestBadgeCount = received.filter((item) => !item.logbook_action_taken).length + pendingReconsiderationCount;

  a.innerHTML = h("Logbook requests", "Each reconsideration stays attached to the original request, so the activity, original decision, resident reason and your new decision remain in one place.") + `
    <section class="card mailbox wide-mailbox">
      <div class="mailbox-tabs" role="tablist">
        ${views.includes("received") ? `<button class="mailbox-tab ${firstView === "received" ? "active" : ""}" data-logbook-tab="received">Requests <span class="nav-badge inline-badge" ${requestBadgeCount ? "" : "hidden"}>${requestBadgeCount}</span></button>` : ""}
        ${views.includes("sent") ? `<button class="mailbox-tab ${firstView === "sent" ? "active" : ""}" data-logbook-tab="sent">Sent <span class="nav-badge inline-badge" ${sent.filter(item=>!item.logbook_action_taken).length ? "" : "hidden"}>${sent.filter(item=>!item.logbook_action_taken).length}</span></button>` : ""}
        ${views.includes("updates") ? `<button class="mailbox-tab ${firstView === "updates" ? "active" : ""}" data-logbook-tab="updates">Updates <span class="nav-badge inline-badge" ${updates.filter(item=>!item.is_read).length ? "" : "hidden"}>${updates.filter(item=>!item.is_read).length}</span></button>` : ""}
        ${views.includes("trash") ? `<button class="mailbox-tab ${firstView === "trash" ? "active" : ""}" data-logbook-tab="trash">Trash <span class="tag">${trash.length}</span></button>` : ""}
      </div>
      <div class="mail-safety-note"><b>Protected logbook:</b> deleting message copies only hides messages. It never deletes the resident activity from My logbook.</div>
      <div class="mail-tools logbook-mail-tools">
        <div class="request-filters"><input id="messageSearch" type="search" placeholder="Search by any word"><select id="requestResidentFilter"><option value="">All residents</option>${[...new Map(allResidentSources.filter(x=>x.resident_id).map(x=>[String(x.resident_id),x.resident_name])).entries()].sort((a,b)=>String(a[1]||"").localeCompare(String(b[1]||""))).map(([id,name])=>`<option value="${o(id)}">${o(name || "Resident")}</option>`).join("")}</select><select id="requestStatusFilter"><option value="">Approved, rejected or pending</option><option value="pending">Pending / reconsideration needed</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select><select id="requestTypeFilter"><option value="">All conferences/interventions</option>${[...new Set(allTypeSources.map(x=>`${x.activity_category || ""}:${x.activity_kind || ""}`).filter(Boolean))].sort().map(value=>`<option value="${o(value)}">${o(value.split(":")[1] || value)}</option>`).join("")}</select></div>
        <div class="mail-bulk-actions logbook-bulk-actions"><label class="bulk-check"><input id="selectVisibleLogbookMessages" type="checkbox"> Select visible</label><button class="btn danger" data-hide-logbook-selected>Delete selected</button></div>
      </div>
      ${views.includes("received") ? `<div class="mail-panel" data-mail-panel="received" ${firstView === "received" ? "" : "hidden"}><div class="message-list">${rows(received, "received")}${orphanRows}</div></div>` : ""}
      ${views.includes("sent") ? `<div class="mail-panel" data-mail-panel="sent" ${firstView === "sent" ? "" : "hidden"}><div class="message-list">${rows(sent, "sent")}</div></div>` : ""}
      ${views.includes("updates") ? `<div class="mail-panel" data-mail-panel="updates" ${firstView === "updates" ? "" : "hidden"}><div class="message-list notification-lines">${rows(updates, "updates")}</div></div>` : ""}
      ${views.includes("trash") ? `<div class="mail-panel" data-mail-panel="trash" ${firstView === "trash" ? "" : "hidden"}><div class="message-list">${rows(trash, "trash")}</div></div>` : ""}
      <div id="messageSearchEmpty" class="mail-empty" hidden>No logbook items match your search.</div>
    </section>`;
  filterLogbookRequestRows();
}

function openLogbookReclaim(entryId, title, reviewer, reviewerId = "") {
  y(`<form id="logbookReclaimForm" class="modal"><div class="modal-head"><div><span class="eyebrow">Rejected request</span><h2>Request to reconsider ${o(title)}</h2></div><button type="button" data-close>×</button></div><p>Your justification will be sent to ${o(reviewer)} in the normal Inbox and copied to the Program Owner.</p><label>Justification<textarea name="justification" maxlength="3000" required placeholder="Write your reason for reconsideration"></textarea></label><input type="hidden" name="entry_id" value="${o(entryId)}"><input type="hidden" name="reviewer_id" value="${o(reviewerId)}"><div class="actions"><button type="button" class="btn secondary" data-close>Cancel</button><button>Send request to reconsider</button></div></form>`);
}
function filterLogbookRequestRows() {
  const query = (t("#messageSearch")?.value || "").trim().toLowerCase();
  const resident = t("#requestResidentFilter")?.value || "";
  const status = t("#requestStatusFilter")?.value || "";
  const type = t("#requestTypeFilter")?.value || "";
  const activePanel = document.querySelector('[data-mail-panel]:not([hidden])');
  let visible = 0;
  activePanel?.querySelectorAll(".message-row").forEach((row) => {
    const match = (!query || (row.dataset.messageSearch || "").includes(query)) &&
      (!resident || row.dataset.requestResident === resident) &&
      (!status || row.dataset.requestStatus === status) &&
      (!type || row.dataset.requestType === type);
    row.hidden = !match;
    if (match) visible += 1;
  });
  const empty = t("#messageSearchEmpty");
  if (empty) empty.hidden = visible > 0;
  const selectVisible = t("#selectVisibleLogbookMessages");
  if (selectVisible) {
    const boxes = [...(activePanel?.querySelectorAll(".message-row:not([hidden]) .logbook-message-select") || [])];
    selectVisible.checked = Boolean(boxes.length) && boxes.every((box) => box.checked);
    selectVisible.indeterminate = boxes.some((box) => box.checked) && !selectVisible.checked;
  }
}

async function openComposer(replyTo = null) {
  const { data: contacts } = await e.rpc("message_contacts", {
    search_text: null,
  });
  const people = contacts || [];
  const ownerOptions = s.p.role === "owner"
    ? `<label class="full">Recipients<select name="recipient_scope" id="recipientScope" required>
        <option value="selected_people">Specific person or people</option><option value="all_people">All people</option>
        <option value="all_assessors">All assessors</option><option value="selected_assessors">Selected assessors</option>
        <option value="all_residents">All residents</option><option value="year_residents">Residents of one year</option>
        <option value="selected_residents">Selected residents</option></select></label>
      <label class="full" id="recipientPeopleField">Choose recipients<select name="recipient_ids" multiple size="8">${people.map((contact) => `<option value="${contact.id}" data-role="${o(contact.role)}">${o(contact.display_name)} · ${o(m(contact.role))}${contact.residency_year ? ` · Year ${contact.residency_year}` : ""}</option>`).join("")}</select><small>Hold Ctrl (Windows) or Command (Mac) to select several.</small></label>
      <label class="full" id="recipientYearField" hidden>Residency year<select name="residency_year"><option value="">Choose year</option>${n.map((year) => `<option value="${year}">Year ${year}</option>`).join("")}</select></label>`
    : `<label class="full">To<select name="receiver_id" required><option value="">Choose a person</option>${people.map((contact) => `<option value="${contact.id}" ${replyTo === contact.id ? "selected" : ""}>${o(contact.display_name)} · ${o(m(contact.role))}</option>`).join("")}</select></label>`;
  y(`<form id="messageForm" class="modal">
    <div class="modal-head"><div><span class="eyebrow">Private inbox</span><h2>${replyTo ? "Reply" : "New message"}</h2></div><button type="button" data-close>×</button></div>
    <div class="form-grid">
      ${ownerOptions}
      <label class="full">Subject<input name="subject" maxlength="150"></label>
      <label class="full">Message<textarea name="body" maxlength="5000" required></textarea></label>
    </div><div class="actions"><button type="button" class="btn secondary" data-close>Cancel</button><button>Send message</button></div>
  </form>`);
}
function openLogbookDecision(entryId, title, messageId = "", preset = "approved") {
  const rejected = preset === "rejected";
  y(` <form id="logbookReviewForm" class="modal"> <div class="modal-head"><div><span class="eyebrow">Supervisor decision</span><h2>${o(title)}</h2></div><button type="button" data-close>×</button></div><label>Decision<select name="decision" id="logbookDecision" required><option value="approved" ${rejected ? "" : "selected"}>Approve</option><option value="rejected" ${rejected ? "selected" : ""}>Reject</option></select></label><label>Supervisor note <small id="logbookNoteHint">${rejected ? "Required for rejection" : "Optional (defaults to Approved)"}</small><textarea name="note" minlength="2" ${rejected ? "required" : ""}></textarea></label><input type="hidden" name="entry_id" value="${o(entryId)}"><input type="hidden" name="message_id" value="${o(messageId)}"><div class="actions"><button type="button" class="btn secondary" data-close>Cancel</button><button>Submit decision</button></div></form>`);
}
async function k() {
  const i = s.p;
  t("#title").textContent = "Dashboard";
  t("#crumb").textContent = m(i.role);

  if ("resident" === i.role) {
    const [chaptersResult, logsResult, knowledgeResult, skillLevelsResult, assessmentsResult, scheduleResult] = await Promise.all([
      e.from("chapters").select("id,title").lte("year_from", i.residency_year).eq("is_active", !0),
      e.from("skill_logs").select("*", { head: !0, count: "exact" }).eq("resident_id", i.id),
      e.from("knowledge_progress").select("*", { head: !0, count: "exact" }).eq("resident_id", i.id).eq("status", "completed"),
      e.from("skill_levels").select("*", { head: !0, count: "exact" }).eq("resident_id", i.id),
      e.from("assessments").select("*").eq("resident_id", i.id).order("assessment_date", { ascending: !1 }).limit(1),
      e.from("assessment_schedules").select("id,title,starts_at,ends_at,location,assessment_type").eq("is_active", !0).eq("residency_year", i.residency_year).gte("ends_at", new Date().toISOString()).order("starts_at").limit(1),
    ]);
    const latest = assessmentsResult.data?.[0];
    const upcoming = scheduleResult.data?.[0];
    const resultMeta = i.progression_status === "reassessment_required"
      ? `Reassessment ${d(i.reassessment_due)} · ${weakPointSummary(latest)}`
      : latest ? weakPointSummary(latest) : "No formal assessment yet";
    a.innerHTML =
      h(`Welcome, ${i.display_name || i.username}`, "Your year, evidence, assessment and next actions at a glance.", '<button class="btn secondary" data-export-curriculum>Export curriculum PDF</button>') +
      `<div class="dashboard-grid dashboard-grid-6">
        ${dashboardTile("Current residency", yearChip(i.residency_year), i.progression_status === "reassessment_required" ? `Reassessment due ${d(i.reassessment_due)}` : "Current training cohort", "chapters", `year-tile ${yearClass(i.residency_year)}`)}
        ${dashboardTile("My chapters", String(chaptersResult.data?.length || 0), "Cumulative curriculum access", "chapters")}
        ${evidenceDashboardTile(String(knowledgeResult.count || 0), String(skillLevelsResult.count || 0))}
        ${dashboardTile("Logbook activity", String(logsResult.count || 0), "Supervised performances", "logbook")}
        ${dashboardTile("Next assessment", upcoming ? o(d(upcoming.starts_at)) : "—", upcoming ? upcoming.title : "No upcoming window", "assessments", upcoming ? "accent-tile" : "")}
        ${dashboardTile("Latest outcome", latest ? `${o(latest.total_score)}/30` : "—", resultMeta, "assessments", i.progression_status === "reassessment_required" ? "warning-tile" : latest?.overall_pass ? "success-tile" : "")}
      </div>`;
    return;
  }

  if ("observer" === i.role) {
    const [reviewsResult, logbookResult, inboxResult] = await Promise.all([
      reviewRpcResult(null),
      e.rpc("get_logbook_messages", { p_view: "received" }),
      e.rpc("get_private_messages", { p_box: "inbox" }),
    ]);
    const reviews = reviewsResult.data || [];
    const logbook = logbookResult.data || [];
    const inbox = inboxResult.data || [];
    const pendingApprovals = logbook.filter((message) => !message.logbook_action_taken).length;
    const unread = inbox.filter((message) => !message.is_read).length;
    a.innerHTML =
      h(`Welcome, ${i.display_name || i.username}`, "Four quick areas for observations, approvals and communication.", '<button class="btn secondary" data-export-curriculum>Export curriculum PDF</button>') +
      `<div class="dashboard-grid dashboard-grid-4">
        ${dashboardTile("Write a review", "＋", "Positive/negative · named or anonymous", "write-review", "accent-tile")}
        ${dashboardTile("My reviews", String(reviews.length), "Your previous clinical and behavioural reviews", "reviews")}
        ${dashboardTile("Logbook approvals", String(pendingApprovals), pendingApprovals ? "Waiting for your decision" : "Nothing waiting", "logbook", pendingApprovals ? "warning-tile" : "")}
        ${dashboardTile("Inbox", String(unread), unread ? "Unread messages" : "No unread messages", "inbox")}
      </div>`;
    return;
  }

  if ("assessor" === i.role) {
    const assigned = (await S()).data || [];
    const residentIds = assigned.map((item) => item.resident_id);
    const [scheduleResult, assessmentsResult, commentsResult, logbookResult] = await Promise.all([
      e.rpc("my_assessor_schedule"),
      e.from("assessments").select("resident_id", { head: !0, count: "exact" }).eq("assessor_id", i.id),
      reviewRpcResult(null),
      e.rpc("get_logbook_messages", { p_view: "received" }),
    ]);
    const nextAssessment = (scheduleResult.data || []).filter((item) => item.schedule_status !== "finished").sort((x, y) => new Date(x.starts_at) - new Date(y.starts_at))[0];
    const pendingApprovals = (logbookResult.data || []).filter((message) => !message.logbook_action_taken).length;
    a.innerHTML =
      h(`Welcome, ${i.display_name || i.username}`, "Your assessment workspace is divided into six quick areas.", '<button class="btn secondary" data-export-curriculum>Export curriculum PDF</button>') +
      `<div class="dashboard-grid dashboard-grid-6">
        ${dashboardTile("Assigned residents", String(assigned.length), "Open resident records", "residents")}
        ${dashboardTile("Next assessment", nextAssessment ? o(d(nextAssessment.starts_at)) : "—", nextAssessment ? `${nextAssessment.title} · Year ${nextAssessment.residency_year}` : "No upcoming assessment", "assessments", nextAssessment ? "accent-tile" : "")}
        ${dashboardTile("Assessments done", String(assessmentsResult.count || 0), "Your submitted assessments", "assessments")}
        ${dashboardTile("Reviews", String((commentsResult.data || []).length), "Mine + assigned residents", "write-review")}
        ${dashboardTile("Logbook requests", String(pendingApprovals), pendingApprovals ? "Waiting for your decision" : "Nothing waiting", "logbook", pendingApprovals ? "warning-tile" : "")}
        ${dashboardTile("Write a review", "＋", "Positive/negative · named or anonymous", "write-review", "accent-tile")}
      </div>`;
    return;
  }

  const [profilesResult, assessmentsResult, schedulesResult, chaptersResult, inboxResult] = await Promise.all([
    e.from("profiles").select("role,progression_status,is_active,residency_year"),
    e.from("assessments").select("*", { head: !0, count: "exact" }),
    e.from("assessment_schedules").select("*", { head: !0, count: "exact" }).eq("is_active", !0).gte("ends_at", new Date().toISOString()),
    e.from("chapters").select("*", { head: !0, count: "exact" }).eq("is_active", !0),
    e.rpc("get_private_messages", { p_box: "inbox" }),
  ]);
  const profiles = profilesResult.data || [];
  const residents = profiles.filter((person) => person.role === "resident");
  const reassessmentCount = residents.filter((person) => person.progression_status === "reassessment_required").length;
  const unread = (inboxResult.data || []).filter((message) => !message.is_read).length;
  a.innerHTML =
    h("Training program at a glance", "Six compact control areas; detailed tools stay one tap away.", '<div class="lead-actions"><button class="btn secondary" data-export-curriculum>Export curriculum PDF</button><button class="btn" data-create>Create account</button></div>') +
    `<div class="dashboard-grid dashboard-grid-6 owner-dashboard-grid">
      ${dashboardTile("Accounts", String(profiles.length), `${profiles.filter((person) => person.is_active).length} active accounts`, "users")}
      ${dashboardTile("Residents", String(residents.length), reassessmentCount ? `${reassessmentCount} awaiting reassessment` : "Cohorts on track", "progress", reassessmentCount ? "warning-tile" : "")}
      ${dashboardTile("Curriculum", String(chaptersResult.count || 0), "Active chapters", "curriculum")}
      ${dashboardTile("Assessment centre", String(schedulesResult.count || 0), `${assessmentsResult.count || 0} assessments recorded`, "owner-assessment-center", "accent-tile")}
      ${dashboardTile("Logbooks", "Open", "Review, export, reset and requests", "owner-logbook-center")}
      ${dashboardTile("Inbox", String(unread), unread ? "Unread messages" : "No unread messages", "inbox")}
    </div>`;
}

function filterAccountRows() {
  const query = (t("#accountSearch")?.value || "").trim().toLowerCase();
  const role = t("#accountRoleFilter")?.value || "";
  document.querySelectorAll(".account-row").forEach((row) => {
    row.hidden = Boolean((query && !(row.dataset.accountSearch || "").includes(query)) || (role && row.dataset.accountRole !== role));
  });
}
function syncEditAccountYearField() {
  const resident = t("#editAccountRole")?.value === "resident";
  const field = t("#editAccountYearField");
  const select = field?.querySelector("select");
  if (field && select) {
    field.hidden = !resident;
    select.disabled = !resident;
    select.required = resident;
  }
}
function openAccountManagement(person) {
  if (s.p.role !== "owner" || !person || person.role === "owner") return;
  y(`<form id="ownerAccountEditForm" class="modal compact-modal">
    <div class="modal-head"><div><span class="eyebrow">Owner account control</span><h2>${o(person.display_name || person.username)}</h2><p>@${o(person.username || "")} · ${o(person.email || "")}</p></div><button type="button" data-close>×</button></div>
    <div class="form-grid compact-form-grid">
      <label>Account role<select name="role" id="editAccountRole" required><option value="resident" ${person.role === "resident" ? "selected" : ""}>Resident</option><option value="observer" ${person.role === "observer" ? "selected" : ""}>Observer</option><option value="assessor" ${person.role === "assessor" ? "selected" : ""}>Assessor</option></select></label>
      <label id="editAccountYearField">Residency year<select name="residency_year">${n.map((year) => `<option value="${year}" ${Number(person.residency_year || 1) === year ? "selected" : ""}>Year ${year}</option>`).join("")}</select></label>
    </div>
    <div class="role-change-note"><b>Historical data is preserved.</b><span>Changing role or residency year does not delete previous assessments, reviews or resident logbook records. If changed to Assessor, choose assessment cohorts later in Assessor assignments.</span></div>
    <input type="hidden" name="user_id" value="${o(person.id)}">
    <div class="actions"><button type="button" class="btn secondary" data-close>Cancel</button><button>Save account allocation</button></div>
  </form>`);
  syncEditAccountYearField();
}
async function ownerAssessmentCenterPage() {
  if (s.p.role !== "owner") return g("dashboard");
  t("#title").textContent = "Assessment centre";
  a.innerHTML = h("Assessment centre", "Scheduling, progression, assessment history and assessor allocation.") + `<div class="dashboard-grid dashboard-grid-4 hub-grid">
    ${dashboardTile("Assessment schedule", "Windows", "Create and edit assessment windows", "schedule")}
    ${dashboardTile("Resident progress", "Cohorts", "Progression, weak points and reassessment", "progress")}
    ${dashboardTile("Assessment history", "Results", "Permanent scoring history", "assessments")}
    ${dashboardTile("Assessor assignments", "Access", "Choose cohorts each assessor can assess", "assignments")}
  </div>`;
}
async function ownerLogbookCenterPage() {
  if (s.p.role !== "owner") return g("dashboard");
  t("#title").textContent = "Logbook centre";
  a.innerHTML = h("Logbook centre", "Resident e-logbooks, approval requests, export and protected reset controls.") + `<div class="dashboard-grid dashboard-grid-4 hub-grid">
    ${dashboardTile("Resident logbooks", "Open", "Review, export or reset selected/all logbooks", "logbook")}
    ${dashboardTile("Logbook requests", "Review", "Sequential senior → assessor approval workflow", "logbook-requests")}
    ${dashboardTile("Intervention audit", "Fairness", "Compare exposure, trials, successes and failed trials by residency year", "owner-intervention-audit")}
    ${dashboardTile("Message cleanup", "Clean", "Clear message copies without changing resident logbooks", "message-cleanup")}
  </div>`;
}
async function ownerInterventionAuditPage() {
  if (s.p.role !== "owner") return g("dashboard");
  t("#title").textContent = "Intervention audit";
  const rows = u(await e.rpc("owner_intervention_audit_v1051")) || [];
  const years = [...new Set(rows.map((row) => Number(row.residency_year)).filter(Boolean))].sort((a,b)=>a-b);
  const procedures = [...new Map(rows.map((row) => [String(row.procedure_name), Number(row.procedure_order) || 999])).entries()]
    .sort((a,b)=>a[1]-b[1]).map(([name])=>name);
  window.ownerInterventionAuditRows = rows;
  window.ownerInterventionAuditResidents = [...new Map(rows.map((row) => [String(row.resident_id), { id: row.resident_id, name: row.resident_name, year: Number(row.residency_year) || null }])).values()]
    .sort((left, right) => (Number(left.year) - Number(right.year)) || String(left.name || "").localeCompare(String(right.name || "")));

  a.innerHTML = h(
    "Intervention fairness audit",
    "Compare verified intervention opportunities between residents. Only approved logbook entries are counted; trials exclude observation-only attendance.",
    '<div class="inline-actions audit-head-actions"><button class="btn secondary" data-go="owner-logbook-center">Back to Logbooks</button><button class="btn danger" type="button" data-audit-reset="selected">Reset selected residents</button><button class="btn danger danger-button" type="button" data-audit-reset="all">Reset ALL logbooks</button></div>',
  ) + `
    <section class="card intervention-audit-card">
      <div class="audit-reset-explainer"><b>Test-data reset:</b><span>The audit is calculated from resident e-logbook entries. Resetting logbooks removes those test interventions/conferences and the audit returns to zero. Curriculum, reviews, assessments and accounts are not changed.</span></div>
      <div class="intervention-audit-filters">
        <label>Residency year<select id="auditYearFilter"><option value="">All years</option>${years.map((year)=>`<option value="${year}">Year ${year}</option>`).join("")}</select></label>
        <label>Intervention<select id="auditProcedureFilter"><option value="">All interventions</option>${procedures.map((name)=>`<option value="${o(name)}">${o(name)}</option>`).join("")}</select></label>
        <label>Resident search<input id="auditResidentSearch" type="search" placeholder="Name"></label>
      </div>
      <div class="audit-definition-strip">
        <span><b>Verified only</b> = approved logbook entries</span><span><b>Exposure</b> = attended + trials</span>
        <span><b>Trials</b> = success + failed trial</span>
        <span><b>Success</b> = performed with assistance / solo guided / solo unguided</span>
        <span><b>Failed</b> = failed trial</span>
      </div>
      <div id="auditSummary" class="audit-summary-grid"></div>
      <div class="table-scroll"><table class="table intervention-audit-table">
        <thead><tr><th>Resident</th><th>Year</th><th>Intervention</th><th>Attended</th><th>Trials</th><th>Successful</th><th>Failed</th><th>Success %</th><th>Total exposure</th></tr></thead>
        <tbody id="interventionAuditBody"></tbody>
      </table></div>
      <div id="interventionAuditEmpty" class="mail-empty" hidden>No residents match these filters.</div>
    </section>`;
  renderOwnerInterventionAudit();
}

function renderOwnerInterventionAudit() {
  const rows = window.ownerInterventionAuditRows || [];
  const year = Number(t("#auditYearFilter")?.value) || 0;
  const procedure = t("#auditProcedureFilter")?.value || "";
  const search = (t("#auditResidentSearch")?.value || "").trim().toLowerCase();
  const filtered = rows.filter((row) =>
    (!year || Number(row.residency_year) === year) &&
    (!procedure || row.procedure_name === procedure) &&
    (!search || String(row.resident_name || "").toLowerCase().includes(search))
  );
  const body = t("#interventionAuditBody");
  const empty = t("#interventionAuditEmpty");
  if (!body) return;
  body.innerHTML = filtered.map((row) => {
    const trials = Number(row.trial_count) || 0;
    const success = Number(row.success_count) || 0;
    const failed = Number(row.failed_count) || 0;
    const pct = trials ? `${Math.round(success * 100 / trials)}%` : "—";
    return `<tr>
      <td><b>${o(row.resident_name || "Resident")}</b></td>
      <td>${yearChip(row.residency_year)}</td>
      <td><b>${o(row.procedure_name)}</b></td>
      <td>${Number(row.attended_count)||0}</td>
      <td><b>${trials}</b></td>
      <td><span class="tag success">${success}</span></td>
      <td><span class="tag ${failed ? "danger" : "neutral"}">${failed}</span></td>
      <td>${pct}</td>
      <td>${Number(row.total_exposure)||0}</td>
    </tr>`;
  }).join("");
  if (empty) empty.hidden = filtered.length > 0;

  const totals = filtered.reduce((acc,row)=>{
    acc.exposure += Number(row.total_exposure)||0;
    acc.trials += Number(row.trial_count)||0;
    acc.success += Number(row.success_count)||0;
    acc.failed += Number(row.failed_count)||0;
    return acc;
  },{exposure:0,trials:0,success:0,failed:0});
  const residents = new Set(filtered.map((row)=>String(row.resident_id))).size;
  const summary = t("#auditSummary");
  if (summary) summary.innerHTML = `
    <article><span>Residents</span><b>${residents}</b></article>
    <article><span>Total exposure</span><b>${totals.exposure}</b></article>
    <article><span>Trials</span><b>${totals.trials}</b></article>
    <article><span>Successful</span><b>${totals.success}</b></article>
    <article><span>Failed trials</span><b>${totals.failed}</b></article>
    <article><span>Success rate</span><b>${totals.trials ? Math.round(totals.success*100/totals.trials) : 0}%</b></article>`;
}

function openOwnerInterventionAuditReset(mode) {
  if (s.p.role !== "owner") return;
  const residents = window.ownerInterventionAuditResidents || [];
  if (mode === "all") {
    y(`<form id="ownerAuditResetForm" class="modal owner-audit-reset-modal">
      <div class="modal-head"><div><span class="eyebrow rose">Owner-only destructive action</span><h2>Reset ALL resident logbooks</h2></div><button type="button" data-close>×</button></div>
      <div class="danger-confirmation-box"><b>This permanently clears all resident intervention and conference test records.</b><p>The Intervention Audit will return to zero after the reset.</p><p>Accounts, curriculum, reviews, formal assessments and schedules are preserved.</p></div>
      <label>Type <b>RESET LOGBOOKS</b> to confirm<input name="confirmation" autocomplete="off" required placeholder="RESET LOGBOOKS"></label>
      <input type="hidden" name="mode" value="all">
      <div class="actions"><button type="button" class="btn secondary" data-close>Cancel</button><button class="btn danger danger-button">Reset ALL logbooks</button></div>
    </form>`);
    return;
  }
  y(`<form id="ownerAuditResetForm" class="modal owner-audit-reset-modal">
    <div class="modal-head"><div><span class="eyebrow rose">Owner-only destructive action</span><h2>Reset selected resident logbooks</h2></div><button type="button" data-close>×</button></div>
    <p>Select the residents whose test intervention/conference records should be cleared. Their accounts, curriculum progress, reviews and assessments are not changed.</p>
    <div class="audit-reset-select-toolbar"><button class="btn secondary" type="button" data-audit-modal-select-all>Select all</button><button class="btn secondary" type="button" data-audit-modal-clear>Clear</button></div>
    <div class="audit-reset-resident-list">${residents.map((resident) => `<label><input type="checkbox" name="resident_ids" value="${o(resident.id)}"><span><b>${o(resident.name || "Resident")}</b><small>${resident.year ? `Year ${resident.year}` : ""}</small></span></label>`).join("") || '<div class="panel-empty">No active residents found.</div>'}</div>
    <label>Type <b>RESET SELECTED</b> to confirm<input name="confirmation" autocomplete="off" required placeholder="RESET SELECTED"></label>
    <input type="hidden" name="mode" value="selected">
    <div class="actions"><button type="button" class="btn secondary" data-close>Cancel</button><button class="btn danger">Reset selected residents</button></div>
  </form>`);
}

async function ownerToolsPage() {
  if (s.p.role !== "owner") return g("dashboard");
  t("#title").textContent = "More";
  a.innerHTML = h("More owner tools", "Less-used tools live here so the side drawer stays short.") + `<div class="dashboard-grid dashboard-grid-4 hub-grid">
    ${dashboardTile("Observer reviews", "Reviews", "Signed observer comments", "comments")}
    ${dashboardTile("Message cleanup", "Cleanup", "Delete message categories safely", "message-cleanup")}
    ${dashboardTile("Test-period reset", "RESET", "Clear test reviews and resident learning progress", "owner-test-reset", "warning-tile")}
    ${dashboardTile("My profile", "Profile", "Photo, contact details and password", "profile")}
    ${dashboardTile("Assessment centre", "Open", "Schedule and program progression", "owner-assessment-center")}
  </div>`;
}

async function ownerTestResetPage() {
  if (s.p.role !== "owner") return g("dashboard");
  t("#title").textContent = "Test-period reset";
  const preview = u(await e.rpc("owner_test_period_reset_preview_v1058")) || {};
  const reviewCount = Number(preview.reviews || 0);
  const knowledgeCount = Number(preview.knowledge_progress || 0);
  const skillLevelCount = Number(preview.skill_levels || 0);
  const skillLogCount = Number(preview.skill_logs || 0);
  a.innerHTML = h(
    "End test period / start clean",
    "Owner-only reset controls for removing trial data before residents begin the real program.",
    '<button class="btn secondary" data-go="owner-tools">Back to More</button>',
  ) + `
    <section class="card test-reset-warning">
      <div><span class="test-reset-warning-icon">!</span></div>
      <div><h3>These actions are permanent</h3><p>They are intentionally separate from normal administration. Curriculum chapters and item definitions are preserved.</p></div>
    </section>
    <div class="test-reset-grid">
      <section class="card test-reset-card">
        <div class="test-reset-card-head"><div><span class="eyebrow">Reviews</span><h3>Reset all reviews</h3></div><strong>${reviewCount}</strong></div>
        <p>Deletes every clinical/behavioural review, review reconsideration state, and review-related Inbox notification created during testing.</p>
        <ul><li>Does not delete residents or accounts.</li><li>Does not delete assessments.</li><li>Does not delete resident e-logbooks.</li></ul>
        <button class="btn danger" type="button" data-open-test-reset="reviews">Reset ALL reviews</button>
      </section>
      <section class="card test-reset-card">
        <div class="test-reset-card-head"><div><span class="eyebrow">Knowledge & skills</span><h3>Reset all resident learning progress</h3></div><strong>${knowledgeCount + skillLevelCount + skillLogCount}</strong></div>
        <div class="test-reset-mini-stats"><span><b>${knowledgeCount}</b> knowledge checks</span><span><b>${skillLevelCount}</b> skill levels</span><span><b>${skillLogCount}</b> skill performances</span></div>
        <p>Clears resident Knowledge checkmarks, selected Skill levels, and chapter Skill performance logs so every resident starts from zero.</p>
        <p class="form-note"><b>Preserved:</b> the Knowledge/Skill curriculum itself, assessments, accounts, e-logbook interventions/conferences and schedules.</p>
        <button class="btn danger" type="button" data-open-test-reset="learning">Reset ALL knowledge & skills progress</button>
      </section>
      <section class="card test-reset-card logbook-test-reset-card">
        <div class="test-reset-card-head"><div><span class="eyebrow">Resident e-logbooks</span><h3>Reset intervention & conference test data</h3></div><strong>LOG</strong></div>
        <p>Clears all resident logbook interventions, conferences, approval requests and reconsideration copies created during testing. The Intervention Audit will return to zero.</p>
        <p class="form-note"><b>Preserved:</b> accounts, curriculum definitions, reviews, assessments and schedules.</p>
        <button class="btn danger" type="button" data-audit-reset="all">Reset ALL logbooks</button>
      </section>
    </div>
    <section class="card test-reset-all-card">
      <div><span class="eyebrow rose">Complete trial-data cleanup</span><h3>Reset reviews + knowledge & skills together</h3><p>Use this once when your testing period is finished and you want all users to begin their real training data from a clean review and learning-progress state.</p></div>
      <button class="btn danger danger-button" type="button" data-open-test-reset="all">RESET BOTH</button>
    </section>`;
}

function openOwnerTestResetConfirmation(scope) {
  if (s.p.role !== "owner") return;
  const config = {
    reviews: { title: "Reset ALL reviews", phrase: "RESET REVIEWS", detail: "All review records, reconsideration data and review-related messages will be permanently removed." },
    learning: { title: "Reset ALL knowledge & skills progress", phrase: "RESET LEARNING", detail: "All resident knowledge progress, skill levels and chapter skill-performance logs will be permanently removed." },
    all: { title: "Reset reviews + learning progress", phrase: "RESET TEST DATA", detail: "All reviews plus every resident's knowledge/skill progress will be permanently removed." },
  }[scope];
  if (!config) return;
  y(`<form id="ownerTestResetForm" class="modal owner-test-reset-modal">
    <div class="modal-head"><div><span class="eyebrow rose">Owner-only destructive action</span><h2>${o(config.title)}</h2></div><button type="button" data-close>×</button></div>
    <div class="danger-confirmation-box"><b>This cannot be undone.</b><p>${o(config.detail)}</p><p>Accounts, curriculum definitions, formal assessments and resident e-logbooks are not part of this reset.</p></div>
    <label>Type <b>${o(config.phrase)}</b> to confirm<input name="confirmation" autocomplete="off" required placeholder="${o(config.phrase)}"></label>
    <input type="hidden" name="scope" value="${o(scope)}">
    <div class="actions"><button type="button" class="btn secondary" data-close>Cancel</button><button class="btn danger danger-button">Confirm permanent reset</button></div>
  </form>`);
}

function A(e) {
  return ` <article class="card"> <div class="lead"> <div> <h2>Year ${e.assessed_year} ${o(e.assessment_type)}</h2> <p>${d(e.assessment_date)} · Assessor: ${o(e.assessor_signature)}</p> </div> <span class="tag ${e.overall_pass ? "success" : "danger"}">${e.overall_pass ? "Passed" : "Failed"}</span> </div> <div class="score"> <div><b>${e.knowledge_score}/10</b><small>Knowledge</small></div> <div><b>${e.skills_score}/10</b><small>Skills</small></div> <div><b>${e.attitude_score}/10</b><small>Attitude</small></div> <div><b>${e.total_score}/30</b><small>Total</small></div> </div> ${["knowledge", "skills", "attitude"].map((s) => (e[`${s}_justification`] ? `<p><b>${s}:</b> ${o(e[`${s}_justification`])}</p>` : "")).join("")} ${e.overall_pass ? "" : `<p class="warning">Reassessment due ${d(e.reassessment_due)}</p>`} </article>`;
}
function registerReviewRows(rows) {
  const current = window.observerReviewRows instanceof Map ? window.observerReviewRows : new Map();
  (rows || []).forEach((row) => current.set(String(row.id), row));
  window.observerReviewRows = current;
}
function reviewDomainLabel(row) {
  return String(row?.category || "").toLowerCase() === "attitude" ? "Behavioural" : "Clinical";
}
function reviewCategoryLabel(row) {
  const value = String(row?.category || "review").toLowerCase();
  if (value === "attitude") return "Behavioural";
  return value.charAt(0).toUpperCase() + value.slice(1);
}
function reviewReconsiderationLabel(status) {
  const value = String(status || "none");
  if (value === "requested") return '<span class="tag warning">Pending reconsideration</span>';
  if (value === "accepted") return '<span class="tag success reconsidered-tag"><span aria-hidden="true">💡</span> Modified after reconsideration</span>';
  if (value === "upheld") return '<span class="tag neutral">Original review upheld</span>';
  return '<span class="muted">—</span>';
}
function renderCommentsTable(rows, mode = "viewer") {
  const list = rows || [];
  registerReviewRows(list);
  if (!list.length) return v("No reviews are available yet.");
  const showResident = mode !== "resident";
  const residents = [...new Set(list.map((row) => row.resident_name).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b)));
  const reviewers = [...new Set(list.map((row) => row.display_observer || row.observer_signature || (row.is_anonymous ? "Anonymous reviewer" : "Reviewer")).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b)));
  const body = list.map((row) => {
    const positive = row.sentiment !== "negative";
    const status = String(row.reconsideration_status || "none");
    const displayObserver = row.display_observer || row.observer_signature || (row.is_anonymous ? "Anonymous reviewer" : "Reviewer");
    const domain = reviewDomainLabel(row);
    const category = reviewCategoryLabel(row);
    const residentAction = mode === "resident" && status === "none"
      ? `<button class="btn small secondary" data-review-reconsider="${o(row.id)}">Request to reconsider</button>`
      : "";
    const authorActions = mode === "author" && status === "requested"
      ? `<button class="btn small success-button" data-review-resolve="${o(row.id)}" data-review-decision="accepted">Accept / edit</button><button class="btn small danger-button" data-review-resolve="${o(row.id)}" data-review-decision="upheld">Keep original</button>`
      : "";
    const detailsAction = `<button class="btn small secondary" data-open-review-notification="${o(row.id)}">Details</button>`;
    const ownerIdentity = mode === "owner" && row.actual_observer_name && row.is_anonymous
      ? `<small class="owner-identity-note">Actual author: ${o(row.actual_observer_name)}</small>`
      : "";
    const searchText = `${row.resident_name || ""} ${domain} ${category} ${positive ? "good positive" : "bad negative"} ${row.comment || ""} ${row.place || ""} ${displayObserver} ${status} ${row.reconsideration_text || ""}`.toLowerCase();
    return `<tr class="review-data-row" data-review-search="${o(searchText)}" data-review-resident="${o(String(row.resident_name || ""))}" data-review-domain="${o(domain.toLowerCase())}" data-review-tone="${positive ? "positive" : "negative"}" data-review-category="${o(String(row.category || "").toLowerCase())}" data-review-reconsideration="${o(status)}">
      ${showResident ? `<td data-label="Resident"><b>${o(row.resident_name || "Resident")}</b></td>` : ""}
      <td data-label="Domain"><span class="tag ${domain === "Behavioural" ? "review-domain-behavioural" : "neutral"}">${o(domain)}</span></td>
      <td data-label="Category">${o(category)}</td>
      <td data-label="Type"><span class="review-table-tone ${positive ? "positive" : "negative"}">${positive ? "👍 Good" : "👎 Bad"}</span></td>
      <td data-label="Review" class="review-table-comment">${o(row.comment || "—")}</td>
      <td data-label="Date">${d(row.observed_on)}</td>
      <td data-label="Place">${o(row.place || "—")}</td>
      <td data-label="Reviewer">${o(displayObserver)}${ownerIdentity}</td>
      <td data-label="Reconsideration">${reviewReconsiderationLabel(status)}${row.reconsideration_text ? `<small class="review-request-preview">${o(row.reconsideration_text)}</small>` : ""}</td>
      <td data-label="Actions"><div class="table-row-actions">${residentAction}${authorActions}${detailsAction}</div></td>
    </tr>`;
  }).join("");
  return `<section class="card review-table-card">
    <div class="panel-heading"><div><h3>Review table</h3><p class="muted">Filter by resident, domain, good/bad feedback or reconsideration status.</p></div><span class="tag">${list.length} reviews</span></div>
    <div class="review-table-filters">
      <input type="search" data-review-filter="search" placeholder="Search reviews">
      ${showResident ? `<select data-review-filter="resident"><option value="">All residents</option>${residents.map((name)=>`<option value="${o(name)}">${o(name)}</option>`).join("")}</select>` : ""}
      <select data-review-filter="domain"><option value="">Clinical + behavioural</option><option value="clinical">Clinical</option><option value="behavioural">Behavioural</option></select>
      <select data-review-filter="category"><option value="">All categories</option><option value="knowledge">Knowledge</option><option value="skill">Skill</option><option value="attitude">Behavioural</option></select>
      <select data-review-filter="tone"><option value="">Good + bad</option><option value="positive">Good reviews</option><option value="negative">Bad reviews</option></select>
      <select data-review-filter="reconsideration"><option value="">All reconsideration states</option><option value="none">No reconsideration</option><option value="requested">Pending reconsideration</option><option value="accepted">Modified after reconsideration</option><option value="upheld">Original upheld</option></select>
    </div>
    <div class="table-scroll"><table class="table review-data-table"><thead><tr>${showResident ? "<th>Resident</th>" : ""}<th>Domain</th><th>Category</th><th>Type</th><th>Review</th><th>Date</th><th>Place</th><th>Reviewer</th><th>Reconsideration</th><th></th></tr></thead><tbody>${body}</tbody></table></div>
    <div class="mail-empty" data-review-empty hidden>No reviews match these filters.</div>
  </section>`;
}
function filterReviewTable(card) {
  if (!card) return;
  const value = (key) => card.querySelector(`[data-review-filter="${key}"]`)?.value || "";
  const search = value("search").trim().toLowerCase();
  const resident = value("resident");
  const domain = value("domain");
  const category = value("category");
  const tone = value("tone");
  const reconsideration = value("reconsideration");
  let visible = 0;
  card.querySelectorAll(".review-data-row").forEach((row) => {
    const match = (!search || (row.dataset.reviewSearch || "").includes(search)) &&
      (!resident || row.dataset.reviewResident === resident) &&
      (!domain || row.dataset.reviewDomain === domain) &&
      (!category || row.dataset.reviewCategory === category) &&
      (!tone || row.dataset.reviewTone === tone) &&
      (!reconsideration || row.dataset.reviewReconsideration === reconsideration);
    row.hidden = !match;
    if (match) visible += 1;
  });
  const empty = card.querySelector("[data-review-empty]");
  if (empty) empty.hidden = visible > 0;
}
function renderResidentReviewGroups(rows) {
  return renderCommentsTable(rows || [], "resident");
}
async function S() {
  return e.rpc("assessor_assigned_residents");
}
function C(e) {
  return e.length
    ? ` <section class="card table-card"> <div class="table-scroll"> <table class="table"> <thead><tr><th>Resident</th><th>Assigned cohort</th><th></th></tr></thead> <tbody>${e.map((e) => ` <tr> <td>${o(e.resident_name || e.username)}</td> <td>${yearChip(e.residency_year)}</td> <td><button class="btn" data-candidate="${e.resident_id}~">Open record</button></td> </tr>`).join("")}</tbody> </table> </div> </section>`
    : v("No residents are assigned to your assessment years yet.");
}
function M(e) {
  const s = new Map();
  return (
    e.forEach((e) => {
      const t = s.get(e.assessor_id) || [];
      (t.push(Number(e.residency_year)),
        s.set(
          e.assessor_id,
          t.sort((e, s) => e - s),
        ));
    }),
    s
  );
}
async function j() {
  if ("owner" !== s.p.role) return g("dashboard");
  const [t, i] = await Promise.all([
      e
        .from("profiles")
        .select("id,display_name,email,is_active")
        .eq("role", "assessor")
        .order("display_name"),
      e
        .from("assessor_year_assignments")
        .select("assessor_id,residency_year,is_active")
        .eq("is_active", !0)
        .order("residency_year"),
    ]),
    r = M(i.data || []);
  a.innerHTML =
    h(
      "Assessor assignments",
      "Each assessor can cover one or several residency years.",
    ) +
    ` <div class="assignment-grid">${
      (t.data || [])
        .map((e) => {
          const s = r.get(e.id) || [];
          return ` <form class="card assessor-year-form" data-assessor-name="${o(e.display_name)}"> <div class="assessor-heading"> <div> <h3>${o(e.display_name)}</h3> <p>${o(e.email)}</p> </div> <span class="tag ${e.is_active ? "success" : "danger"}">${e.is_active ? "Active" : "Suspended"}</span> </div> <fieldset> <legend>Assigned residency years</legend> <div class="year-selector">${n.map((e) => ` <label> <input type="checkbox" name="years" value="${e}" ${s.includes(e) ? "checked" : ""}> <span>Year ${e}</span> </label>`).join("")}</div> </fieldset> <input type="hidden" name="assessor_id" value="${e.id}"> <div class="assignment-footer"> <small>Select all cohorts this assessor can assess.</small> <button class="btn">Save assignments</button> </div> </form>`;
        })
        .join("") || v("No assessor accounts have been created.")
    }</div>`;
}
async function x() {
  const e = s.p.avatar_url
    ? `<img src="${o(s.p.avatar_url)}" alt="Profile photo">`
    : `<span>${o((s.p.display_name || s.p.username || "?").charAt(0).toUpperCase())}</span>`;
  ((t("#title").textContent = "My profile"),
    (a.innerHTML =
      h(
        "My profile",
        "Manage your photo, contact details and account password.",
      ) +
      ` <div class="profile-grid"> <section class="card profile-card"> <div class="card-heading"> <span class="card-icon">ID</span> <div><h3>Personal details</h3><p>Username and email remain permanent.</p></div> </div> <form id="profileForm" class="form-grid"> <div class="avatar-editor full"> <div class="avatar-preview">${e}</div> <label class="avatar-upload">Profile photo<input name="avatar" type="file" accept="image/jpeg,image/png,image/webp"><small>JPG, PNG or WebP · maximum 5 MB</small></label> </div> <label>Display name<input name="display_name" value="${o(s.p.display_name)}" required></label> <label>WhatsApp<input name="whatsapp" value="${o(s.p.whatsapp || "")}"></label> <label>Username<input value="${o(s.p.username)}" disabled></label> <label>Email<input value="${o(s.p.email)}" disabled></label> <div class="full form-submit"><button>Save profile</button></div> </form> </section> <section class="card profile-card password-card"> <div class="card-heading"> <span class="card-icon">••</span> <div><h3>Change password</h3><p>Use at least eight characters.</p></div> </div> <form id="passwordForm" class="password-form"> <label>New password<input type="password" name="password" minlength="8" autocomplete="new-password" required></label> <label>Confirm new password<input type="password" name="confirm" minlength="8" autocomplete="new-password" required></label> <button>Update password</button> </form> </section> </div>`));
}
function L(e, t) {
  const a = `${e}~${t.id}`;
  return (
    s.curriculumItems.set(a, t),
    ` <article class="item admin-item ${t.is_active ? "" : "inactive-item"}"> <div> <div class="item-title-row"> <h4>${o(t.title)}</h4> <span class="tag ${t.is_active ? "success" : "danger"}">${t.is_active ? "Active" : "Hidden"}</span> </div> <p>${o(t.description || "No description")}</p> <small>Order ${t.sort_order || 0}${"skill" === e ? ` · Expected level ${t.expected_level}` : ""}</small> </div><div class="admin-item-actions"><button class="btn secondary" data-curriculum-edit="${a}">Edit</button><button class="btn danger" data-curriculum-delete="${a}" data-item-title="${o(t.title)}">Delete</button></div> </article>`
  );
}
function T(e, s, t = null) {
  const a = "skill" === e;
  y(
    ` <form id="curriculumItemForm" class="modal"> <div class="modal-head"> <div><span class="eyebrow">${a ? "Skill" : "Knowledge point"}</span><h2>${t ? "Edit item" : "Add item"}</h2></div> <button type="button" data-close>×</button> </div> <div class="form-grid"> <label class="full">Title<input name="title" value="${o(t?.title || "")}" maxlength="180" required></label> <label class="full">Description<textarea name="description" maxlength="1200">${o(t?.description || "")}</textarea></label> <label>Display order<input name="sort_order" type="number" min="0" step="1" value="${t?.sort_order ?? 0}" required></label> ${a ? ` <label>Expected independence level <select name="expected_level">${n.map((e) => ` <option value="${e}" ${Number(t?.expected_level || 1) === e ? "selected" : ""}>Level ${e}</option>`).join("")} </select> </label>` : ""} <label class="check-row full"><input name="is_active" type="checkbox" ${!1 !== t?.is_active ? "checked" : ""}> Visible to residents</label> </div> <input type="hidden" name="kind" value="${e}"> <input type="hidden" name="chapter_id" value="${s}"> <input type="hidden" name="item_id" value="${t?.id || ""}"> <div class="actions"> <button type="button" class="btn secondary" data-close>Cancel</button> <button>${t ? "Save changes" : "Add item"}</button> </div> </form>`,
  );
}
function N(e) {
  if (!e.is_active) return ["Inactive", "danger"];
  const s = Date.now();
  return s < new Date(e.starts_at).getTime()
    ? ["Upcoming", "warning"]
    : s <= new Date(e.ends_at).getTime()
      ? ["Open now", "success"]
      : ["Closed", "neutral"];
}
function D(e) {
  const [t, a] = N(e),
    i = (s.scheduleScopes.get(String(e.id)) || [])
      .map((id) => s.scheduleChapters.get(Number(id))?.title)
      .filter(Boolean),
    r = s.scheduleAssessors.get(e.assessor_id);
  return ` <tr> <td data-label="Assessment"> <div class="schedule-title-cell"> <span class="tag ${a}">${t}</span> <div> <h3>${o(e.title)}</h3> ${e.progression_enabled ? '<span class="tag progression-tag">Automatic year progression</span>' : ""} ${e.location ? `<small>${o(e.location)}</small>` : ""} ${e.instructions ? `<p>${o(e.instructions)}</p>` : ""} </div> </div> </td> <td data-label="Cohort"> <strong>${yearChip(e.residency_year)}</strong> <small>${"reassessment" === e.assessment_type ? "Reassessment" : "Initial assessment"}</small> </td> <td data-label="Window"> <div class="date-stack"> <span><b>Opens</b>${l(e.starts_at)}</span> <span><b>Closes</b>${l(e.ends_at)}</span> </div> </td> <td data-label="Scope"> <strong>${o(i.length ? i.join(" · ") : "Whole-year assessment")}</strong> <small>${o(r?.display_name || "Any assigned assessor")}</small> </td> <td class="schedule-action"><button class="btn secondary" data-schedule-edit="${e.id}">Edit</button></td> </tr>`;
}
function O(e = null) {
  const t = [...s.scheduleChapters.values()],
    a = [...s.scheduleAssessors.values()],
    i = e?.starts_at || new Date(Date.now() + 864e5).toISOString(),
    r = e?.ends_at || new Date(Date.now() + 9e7).toISOString(),
    selectedChapters = new Set(s.scheduleScopes.get(String(e?.id)) || []);
  (y(
    ` <form id="scheduleForm" class="modal"> <div class="modal-head"> <div><span class="eyebrow">Owner control</span><h2>${e ? "Edit assessment window" : "Schedule assessment"}</h2></div> <button type="button" data-close>×</button> </div> <div class="form-grid"> <label class="full">Assessment title<input name="title" value="${o(e?.title || "")}" placeholder="e.g. Year 5 final assessment" required></label> <label>Residency year <select name="residency_year" id="scheduleYear">${n.map((s) => ` <option value="${s}" ${Number(e?.residency_year || 1) === s ? "selected" : ""}>Year ${s}</option>`).join("")} </select> </label> <label>Assessment type <select name="assessment_type"> <option value="initial" ${"reassessment" !== e?.assessment_type ? "selected" : ""}>Initial</option> <option value="reassessment" ${"reassessment" === e?.assessment_type ? "selected" : ""}>Reassessment</option> </select> </label> <label>Opens at<input name="starts_at" type="datetime-local" value="${c(i)}" required></label> <label>Closes at<input name="ends_at" type="datetime-local" value="${c(r)}" required></label> <fieldset class="full chapter-selector"><legend>Assessment chapters</legend>${t.map((chapter) => `<label><input type="checkbox" name="chapter_ids" value="${chapter.id}" ${selectedChapters.has(Number(chapter.id)) ? "checked" : ""}><span>Year ${chapter.year_from} · ${o(chapter.title)}</span></label>`).join("")}<small>Leave all unchecked for a whole-year assessment.</small></fieldset> <label>Assessor (optional) <select name="assessor_id" id="scheduleAssessor"> <option value="">Any assessor assigned to the year</option> ${a
      .map((t) => {
        const a = s.assessorYears.get(t.id) || [];
        return `<option value="${t.id}" data-years="${a.join(",")}" ${e?.assessor_id === t.id ? "selected" : ""}> ${o(t.display_name)} · ${a.length ? a.map((e) => `Y${e}`).join(", ") : "no years"}${t.is_active ? "" : " · inactive"} </option>`;
      })
      .join(
        "",
      )} </select> </label> <label class="full">Location / method<input name="location" value="${o(e?.location || "")}" placeholder="e.g. Cardiology Department or online"></label> <label class="full">Instructions<textarea name="instructions">${o(e?.instructions || "")}</textarea></label> <label class="check-row full progression-check"><input name="progression_enabled" type="checkbox" ${e ? (e.progression_enabled ? "checked" : "") : "checked"}> <span><b>End-of-year progression assessment</b><small>Pass → automatically move the resident to the next year and send congratulations. Fail → keep the same year and set reassessment after 2 months with weak points.</small></span></label> <label class="check-row full"><input name="is_active" type="checkbox" ${!1 !== e?.is_active ? "checked" : ""}> Active assessment window</label> </div> <input type="hidden" name="schedule_id" value="${e?.id || ""}"> <div class="actions"> <button type="button" class="btn secondary" data-close>Cancel</button> <button>${e ? "Save changes" : "Create schedule"}</button> </div> </form>`,
  ),
    Y(e?.assessor_id || ""));
}
function Y(e = "") {
  const s = Number(t("#scheduleYear")?.value),
    a = t("#scheduleAssessor");
  if (!a) return;
  [...a.options].forEach((t) => {
    if (!t.value) return;
    const a = t.dataset.years.split(",").filter(Boolean).map(Number);
    t.disabled = !a.includes(s) && t.value !== e;
  });
  const i = a.selectedOptions[0];
  i?.disabled && (a.value = "");
}
function E() {
  const e = "resident" === t("#accountRole")?.value,
    s = t("#accountYearField"),
    a = s?.querySelector("select");
  s && a && ((s.hidden = !e), (a.disabled = !e), (a.required = e));
}
async function R() {
  const s = t("#findResident")?.value.trim(),
    a = Number(t("#findYear")?.value) || null;
  const { data: i } = await e.rpc("search_residents", {
    search_text: s || null,
    filter_year: a,
  });
  t("#results").innerHTML =
    ` <div class="table-scroll"><table class="table"><tbody>${(i || []).map((e) => ` <tr> <td>${o(e.display_name)} · Year ${e.residency_year}</td> <td><button class="btn" data-review="${e.id}" data-name="${o(e.display_name)}">Write review</button></td> </tr>`).join("")}</tbody></table></div>`;
}
const F = {
  procedure: "Manual intervention",
  conference_attendance: "Conference attended",
  conference_lecture: "Conference speech given",
};
function B(e) {
  const statusClass =
    "approved" === e.status
      ? "success"
      : "rejected" === e.status
        ? "danger"
        : "warning";
  const isConference = e.activity_category === "conference";
  const canReviewSenior =
    e.senior_resident_id === s.p.id && e.senior_status === "pending";
  const canReviewAssessor =
    e.assessor_id === s.p.id &&
    e.assessor_status === "pending" &&
    (isConference || e.senior_status === "approved");
  const conferenceDetail = isConference
    ? `<p><b>Conference activity:</b> ${e.conference_participation === "gave_speech" ? "Gave a speech" : "Attended the conference"}</p><p><b>Conference name:</b> ${o(e.title)}</p>`
    : `<p><b>Intervention:</b> ${o(e.procedure_name || e.title)}</p><p><b>Participation:</b> ${o(participationLabel(e.participation_mode))}</p><p><b>Hospital:</b> ${o(e.hospital)}</p>`;
  const approvalDetail = isConference
    ? `<div class="approval-line"><b>Assessor:</b> ${o(e.assessor_name)} <span class="tag">${o(e.assessor_status)}</span>${e.assessor_note ? `<p><b>Note:</b> ${o(e.assessor_note)}</p>` : ""}</div>`
    : `<div class="approval-grid"><div class="approval-line"><b>Senior resident:</b> ${o(e.senior_resident_name)} <span class="tag">${o(e.senior_status)}</span>${e.senior_note ? `<p><b>Note:</b> ${o(e.senior_note)}</p>` : ""}</div><div class="approval-line"><b>Assessor:</b> ${o(e.assessor_name)} <span class="tag">${o(e.assessor_status)}</span>${e.assessor_note ? `<p><b>Note:</b> ${o(e.assessor_note)}</p>` : ""}</div></div>`;
  return ` <article class="card logbook-entry" data-logbook-status="${o(e.status)}" data-logbook-type="${o(e.activity_category)}"> <div class="lead"> <div><span class="eyebrow">${o(F[e.activity_type] || e.activity_type)}</span><h3>${o(e.title)}</h3><p>${d(e.activity_date)} · ${o(e.resident_name)} · Year ${o(e.residency_year)}</p></div> <span class="tag ${statusClass}">${o(e.status)}</span> </div> <div class="logbook-details">${conferenceDetail}${e.description ? `<p><b>Details:</b> ${o(e.description)}</p>` : ""}${approvalDetail}</div> ${canReviewSenior || canReviewAssessor ? `<div class="actions no-print"><button class="btn" data-logbook-review="${e.id}" data-logbook-title="${o(e.title)}">Approve or reject</button></div>` : ""} </article>`;
}


function logbookDecisionBadge(status) {
  const value = String(status || "pending").toLowerCase();
  const cls = value === "approved" ? "success" : value === "rejected" ? "danger" : "warning";
  return `<span class="tag ${cls}">${o(value)}</span>`;
}
function renderAssessorLogbookTable(entries) {
  const rows = entries || [];
  window.logbookEntryRows = new Map(rows.map((entry) => [String(entry.id), entry]));
  const residents = [...new Map(rows.map((entry) => [String(entry.resident_id), entry.resident_name])).entries()]
    .sort((a, b) => String(a[1] || "").localeCompare(String(b[1] || "")));
  const activities = [...new Set(rows.map((entry) => entry.activity_category === "conference" ? entry.title : (entry.procedure_name || entry.title)).filter(Boolean))].sort();
  const participations = [...new Set(rows.map((entry) => entry.activity_category === "conference" ? (entry.conference_participation === "gave_speech" ? "Presenter" : "Attended") : participationLabel(entry.participation_mode)).filter(Boolean))].sort();
  const body = rows.map((entry) => {
    const isConference = entry.activity_category === "conference";
    const activity = isConference ? entry.title : (entry.procedure_name || entry.title);
    const participation = isConference ? (entry.conference_participation === "gave_speech" ? "Presenter" : "Attended") : participationLabel(entry.participation_mode);
    const canReviewSenior = entry.senior_resident_id === s.p.id && entry.senior_status === "pending";
    const canReviewAssessor = entry.assessor_id === s.p.id && entry.assessor_status === "pending" && (isConference || entry.senior_status === "approved");
    const canAct = canReviewSenior || canReviewAssessor;
    const myDecision = entry.assessor_id === s.p.id ? entry.assessor_status : entry.senior_resident_id === s.p.id ? entry.senior_status : "—";
    return `<tr class="assessor-logbook-row" data-resident="${o(String(entry.resident_id || ""))}" data-resident-name="${o(String(entry.resident_name || "").toLowerCase())}" data-category="${o(entry.activity_category || "")}" data-activity="${o(String(activity || "").toLowerCase())}" data-participation="${o(String(participation || "").toLowerCase())}" data-status="${o(myDecision === "—" ? "pending" : myDecision)}">
      <td data-label="Resident"><b>${o(entry.resident_name || "Resident")}</b><small>${yearChip(entry.residency_year)}</small></td>
      <td data-label="Activity"><b>${o(activity || "Activity")}</b><small>${isConference ? "Conference" : "Intervention"}</small></td>
      <td data-label="Participation">${o(participation || "—")}</td>
      <td data-label="Date">${d(entry.activity_date)}</td>
      <td data-label="Senior">${isConference ? "—" : `${o(entry.senior_resident_name || "—")}<br>${logbookDecisionBadge(entry.senior_status)}`}</td>
      <td data-label="Decision">${myDecision === "—" ? "—" : logbookDecisionBadge(myDecision)}</td>
      <td data-label="Actions"><div class="table-row-actions">${canAct ? `<button class="btn small" data-logbook-table-review="${entry.id}" data-logbook-title="${o(entry.title)}">Review</button>` : ""}<button class="btn small secondary" data-logbook-detail="${entry.id}">Details</button></div></td>
    </tr>`;
  }).join("");
  return `<section class="card assessor-logbook-table-card no-print">
    <div class="panel-heading"><div><h3>Resident activity table</h3></div><span class="tag">${rows.length} records</span></div>
    <div class="assessor-logbook-filters">
      <input id="assessorLogbookResidentSearch" type="search" placeholder="Search resident name">
      <select id="assessorLogbookResidentFilter"><option value="">All residents</option>${residents.map(([id,name]) => `<option value="${o(id)}">${o(name || "Resident")}</option>`).join("")}</select>
      <select id="assessorLogbookActivityFilter"><option value="">All interventions / conferences</option>${activities.map((name) => `<option value="${o(String(name).toLowerCase())}">${o(name)}</option>`).join("")}</select>
      <select id="assessorLogbookCategoryFilter"><option value="">All types</option><option value="manual_intervention">Interventions</option><option value="conference">Conferences</option></select>
      <select id="assessorLogbookParticipationFilter"><option value="">All participation</option>${participations.map((name) => `<option value="${o(String(name).toLowerCase())}">${o(name)}</option>`).join("")}</select>
      <select id="assessorLogbookStatusFilter"><option value="">All decisions</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select>
    </div>
    <div class="table-scroll"><table class="table assessor-logbook-table"><thead><tr><th>Resident</th><th>Activity</th><th>Participation</th><th>Date</th><th>Senior</th><th>Decision</th><th></th></tr></thead><tbody>${body || '<tr><td colspan="7">No logbook records are available.</td></tr>'}</tbody></table></div>
    <div id="assessorLogbookEmpty" class="mail-empty" hidden>No records match these filters.</div>
  </section>`;
}
function filterAssessorLogbookTable() {
  const search = (t("#assessorLogbookResidentSearch")?.value || "").trim().toLowerCase();
  const resident = t("#assessorLogbookResidentFilter")?.value || "";
  const activity = t("#assessorLogbookActivityFilter")?.value || "";
  const category = t("#assessorLogbookCategoryFilter")?.value || "";
  const participation = t("#assessorLogbookParticipationFilter")?.value || "";
  const status = t("#assessorLogbookStatusFilter")?.value || "";
  let visible = 0;
  document.querySelectorAll(".assessor-logbook-row").forEach((row) => {
    const match = (!search || (row.dataset.residentName || "").includes(search)) &&
      (!resident || row.dataset.resident === resident) &&
      (!activity || row.dataset.activity === activity) &&
      (!category || row.dataset.category === category) &&
      (!participation || row.dataset.participation === participation) &&
      (!status || row.dataset.status === status);
    row.hidden = !match;
    if (match) visible += 1;
  });
  const empty = t("#assessorLogbookEmpty");
  if (empty) empty.hidden = visible > 0;
}
function logbookWasApprovedAfterReconsideration(entry) {
  const notes = [entry?.senior_note, entry?.assessor_note, entry?.supervisor_note].filter(Boolean).join(" ");
  return /reconsideration approved/i.test(notes);
}
function logbookHistoryStatusBadge(entry) {
  const value = String(entry?.status || "pending").toLowerCase();
  const cls = value === "approved" ? "success" : value === "rejected" ? "danger" : "warning";
  const reconsidered = value === "approved" && logbookWasApprovedAfterReconsideration(entry);
  return `<span class="tag ${cls}">${value === "approved" ? "✓ Approved" : value === "rejected" ? "× Rejected" : "Pending"}</span>${reconsidered ? '<span class="after-reconsideration-lamp" title="Approved after reconsideration" aria-label="Approved after reconsideration">💡</span>' : ""}`;
}
function renderLogbookHistoryTable(entries, mode = "resident") {
  const rows = entries || [];
  const current = window.logbookEntryRows instanceof Map ? window.logbookEntryRows : new Map();
  rows.forEach((entry) => current.set(String(entry.id), entry));
  window.logbookEntryRows = current;
  const showResident = mode !== "resident";
  const residents = [...new Set(rows.map((entry)=>entry.resident_name).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b)));
  const activities = [...new Set(rows.map((entry)=>entry.activity_category === "conference" ? entry.title : (entry.procedure_name || entry.title)).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b)));
  const participations = [...new Set(rows.map((entry)=>entry.activity_category === "conference" ? (entry.conference_participation === "gave_speech" ? "Presenter" : "Attended") : participationLabel(entry.participation_mode)).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b)));
  const body = rows.map((entry) => {
    const conference = entry.activity_category === "conference";
    const activity = conference ? entry.title : (entry.procedure_name || entry.title);
    const participation = conference ? (entry.conference_participation === "gave_speech" ? "Presenter" : "Attended") : participationLabel(entry.participation_mode);
    const searchText = `${entry.resident_name || ""} ${activity || ""} ${participation || ""} ${entry.hospital || ""} ${entry.senior_resident_name || ""} ${entry.assessor_name || ""} ${entry.status || ""}`.toLowerCase();
    return `<tr class="logbook-history-row" data-logbook-history-search="${o(searchText)}" data-logbook-history-resident="${o(String(entry.resident_name || ""))}" data-logbook-history-category="${o(entry.activity_category || "")}" data-logbook-history-activity="${o(String(activity || "").toLowerCase())}" data-logbook-history-participation="${o(String(participation || "").toLowerCase())}" data-logbook-history-status="${o(String(entry.status || "pending").toLowerCase())}">
      ${showResident ? `<td data-label="Resident"><b>${o(entry.resident_name || "Resident")}</b><small>${entry.residency_year ? yearChip(entry.residency_year) : ""}</small></td>` : ""}
      <td data-label="Activity"><b>${o(activity || "Activity")}</b><small>${conference ? "Conference" : "Intervention"}</small></td>
      <td data-label="Participation">${o(participation || "—")}</td>
      <td data-label="Date">${d(entry.activity_date)}</td>
      <td data-label="Hospital">${conference ? "—" : o(entry.hospital || "—")}</td>
      <td data-label="Senior">${conference ? "—" : `${o(entry.senior_resident_name || "—")}<br>${logbookDecisionBadge(entry.senior_status)}`}</td>
      <td data-label="Assessor">${o(entry.assessor_name || "—")}<br>${logbookDecisionBadge(entry.assessor_status)}</td>
      <td data-label="Status">${logbookHistoryStatusBadge(entry)}</td>
      <td data-label="Actions"><button class="btn small secondary" data-logbook-detail="${o(entry.id)}">Details</button></td>
    </tr>`;
  }).join("");
  return `<section class="card logbook-history-table-card no-print">
    <div class="panel-heading"><div><h3>${mode === "resident" ? "My activity history" : "Activity history"}</h3><p class="muted">Filter the full history without scrolling through large cards.</p></div><span class="tag">${rows.length} records</span></div>
    <div class="logbook-history-filters">
      <input type="search" data-logbook-history-filter="search" placeholder="Search activity${showResident ? " or resident" : ""}">
      ${showResident ? `<select data-logbook-history-filter="resident"><option value="">All residents</option>${residents.map((name)=>`<option value="${o(name)}">${o(name)}</option>`).join("")}</select>` : ""}
      <select data-logbook-history-filter="activity"><option value="">All interventions / conferences</option>${activities.map((name)=>`<option value="${o(String(name).toLowerCase())}">${o(name)}</option>`).join("")}</select>
      <select data-logbook-history-filter="category"><option value="">All types</option><option value="manual_intervention">Interventions</option><option value="conference">Conferences</option></select>
      <select data-logbook-history-filter="participation"><option value="">All participation</option>${participations.map((name)=>`<option value="${o(String(name).toLowerCase())}">${o(name)}</option>`).join("")}</select>
      <select data-logbook-history-filter="status"><option value="">All statuses</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select>
    </div>
    <div class="table-scroll"><table class="table logbook-history-table"><thead><tr>${showResident ? "<th>Resident</th>" : ""}<th>Activity</th><th>Participation</th><th>Date</th><th>Hospital</th><th>Senior</th><th>Assessor</th><th>Status</th><th></th></tr></thead><tbody>${body || `<tr><td colspan="${showResident ? 9 : 8}">No logbook activities are available yet.</td></tr>`}</tbody></table></div>
    <div class="mail-empty" data-logbook-history-empty hidden>No activities match these filters.</div>
  </section>`;
}
function filterLogbookHistoryTable(card) {
  if (!card) return;
  const value = (key) => card.querySelector(`[data-logbook-history-filter="${key}"]`)?.value || "";
  const search = value("search").trim().toLowerCase();
  const resident = value("resident");
  const activity = value("activity");
  const category = value("category");
  const participation = value("participation");
  const status = value("status");
  let visible = 0;
  card.querySelectorAll(".logbook-history-row").forEach((row) => {
    const match = (!search || (row.dataset.logbookHistorySearch || "").includes(search)) &&
      (!resident || row.dataset.logbookHistoryResident === resident) &&
      (!activity || row.dataset.logbookHistoryActivity === activity) &&
      (!category || row.dataset.logbookHistoryCategory === category) &&
      (!participation || row.dataset.logbookHistoryParticipation === participation) &&
      (!status || row.dataset.logbookHistoryStatus === status);
    row.hidden = !match;
    if (match) visible += 1;
  });
  const empty = card.querySelector("[data-logbook-history-empty]");
  if (empty) empty.hidden = visible > 0;
}

function openLogbookEntryDetail(entry) {
  if (!entry) return;
  const isConference = entry.activity_category === "conference";
  const activity = isConference ? entry.title : (entry.procedure_name || entry.title);
  const participation = isConference ? (entry.conference_participation === "gave_speech" ? "Presenter" : "Attended") : participationLabel(entry.participation_mode);
  y(`<article class="modal"><div class="modal-head"><div><span class="eyebrow">${isConference ? "Conference" : "Intervention"}</span><h2>${o(activity || "Logbook activity")}</h2></div><button type="button" data-close>×</button></div>
    <div class="logbook-detail-grid"><div><span>Resident</span><b>${o(entry.resident_name || "Resident")}</b></div><div><span>Date</span><b>${d(entry.activity_date)}</b></div><div><span>Participation</span><b>${o(participation || "—")}</b></div>${isConference ? "" : `<div><span>Hospital</span><b>${o(entry.hospital || "—")}</b></div><div><span>Senior resident</span><b>${o(entry.senior_resident_name || "—")}</b> ${logbookDecisionBadge(entry.senior_status)}</div>`}<div><span>Assessor</span><b>${o(entry.assessor_name || "—")}</b> ${logbookDecisionBadge(entry.assessor_status)}</div></div>
    ${entry.senior_note ? `<div class="message-body"><b>Senior note</b><br>${o(entry.senior_note)}</div>` : ""}${entry.assessor_note ? `<div class="message-body"><b>Assessor note</b><br>${o(entry.assessor_note)}</div>` : ""}${entry.description ? `<div class="message-body"><b>Resident notes / evidence</b><br>${o(entry.description)}</div>` : ""}
    <div class="actions"><button class="btn secondary" type="button" data-close>Close</button></div></article>`);
}
function openLogbookReconsiderationDecision(row, decision) {
  if (!row) return;
  const approved = decision === "approved";
  y(`<form id="logbookReconsiderationResolveForm" class="modal"><div class="modal-head"><div><span class="eyebrow">Logbook reconsideration</span><h2>${approved ? "Approve reconsideration" : "Reject reconsideration"}</h2></div><button type="button" data-close>×</button></div>
    <div class="reconsideration-message-summary"><div class="reconsideration-summary-row"><span>Resident</span><b>${o(row.resident_name || "Resident")}</b></div><div class="reconsideration-summary-row"><span>Activity</span><b>${o(row.activity_title || "Logbook activity")}</b></div><div class="reconsideration-summary-reason"><span>Reason</span><p>${o(row.reason || "No reason provided")}</p></div></div>
    <p class="form-note">${approved ? "Your original rejection will change to approval. The final logbook status will then be recalculated from all required reviewers." : "Your original rejection will remain. The resident will be notified that reconsideration was not accepted."}</p>
    <label>Response note <small>Required for either decision</small><textarea name="note" maxlength="3000" required placeholder="Write a short note for your decision"></textarea></label><input type="hidden" name="reconsideration_id" value="${o(row.id)}"><input type="hidden" name="decision" value="${approved ? "approved" : "rejected"}"><div class="actions"><button type="button" class="btn secondary" data-close>Cancel</button><button class="btn ${approved ? "success-button" : "danger-button"}">${approved ? "Approve reconsideration" : "Reject reconsideration"}</button></div></form>`);
}

function ownerSelectedLogbookResidentIds() {
  return [...document.querySelectorAll(".owner-logbook-resident-check:checked")].map(
    (input) => input.value,
  );
}
function filterOwnerLogbookResidents() {
  const query = (t("#ownerLogbookSearch")?.value || "").trim().toLowerCase();
  document.querySelectorAll("[data-owner-logbook-search]").forEach((row) => {
    row.hidden = Boolean(query && !(row.dataset.ownerLogbookSearch || "").includes(query));
  });
}

function logbookExportSections(entries, includeResident = false) {
  const interventions = entries.filter((entry) => entry.activity_category !== "conference");
  const conferences = entries.filter((entry) => entry.activity_category === "conference");
  const preferredOrder = ["CVP", "Intubation", "Temporary pacemaker", "Permanent pacemaker implantation", "Pacemaker programming", "ICD implantation", "CRT implantation", "Pericardiocentesis", "TEE", "DSE", "Coronary angiography", "Elective PCI", "Primary PCI", "IVUS", "Rotablation", "TAVI", "ASD closure", "Mitral balloon valvotomy", "Exercise stress ECG", "Tilting table", "Nuclear imaging", "CT CA", "CMR"];
  const groups = new Map();
  interventions.forEach((entry) => {
    const name = entry.procedure_name || entry.title || "Other intervention";
    const list = groups.get(name) || [];
    list.push(entry);
    groups.set(name, list);
  });
  const groupNames = [...groups.keys()].sort((left, right) => {
    const li = preferredOrder.indexOf(left), ri = preferredOrder.indexOf(right);
    if (li >= 0 || ri >= 0) return (li < 0 ? 999 : li) - (ri < 0 ? 999 : ri);
    return left.localeCompare(right);
  });
  const interventionColspan = includeResident ? 8 : 7;
  let running = 0;
  const interventionRows = groupNames.map((name) => {
    const items = groups.get(name).sort((x, y) => new Date(x.activity_date) - new Date(y.activity_date));
    return `<tr class="procedure-group"><td colspan="${interventionColspan}">${o(name)} <span>${items.length} case${items.length === 1 ? "" : "s"}</span></td></tr>${items.map((entry) => {
      running += 1;
      return `<tr><td>${running}</td>${includeResident ? `<td>${o(entry.resident_name || "—")}</td>` : ""}<td>${d(entry.activity_date)}</td><td>${o(participationLabel(entry.participation_mode))}</td><td>${o(entry.hospital || "—")}</td><td>${o(entry.senior_resident_name || "—")}</td><td class="signature">${o(entry.assessor_name || "—")}</td><td>${o(entry.description || "—")}</td></tr>`;
    }).join("")}`;
  }).join("");
  const summaryRows = groupNames.map((name) => `<tr><td>${o(name)}</td><td>${groups.get(name).length}</td></tr>`).join("");
  const conferenceRows = conferences.sort((x, y) => new Date(x.activity_date) - new Date(y.activity_date)).map((entry, index) => `<tr><td>${index + 1}</td>${includeResident ? `<td>${o(entry.resident_name || "—")}</td>` : ""}<td>${o(entry.title || "Conference")}</td><td>${entry.conference_participation === "gave_speech" ? "Presenter" : "Attended"}</td><td>${d(entry.activity_date)}</td><td class="signature">${o(entry.assessor_name || "—")}</td><td>${o(entry.description || "—")}</td></tr>`).join("");
  return `<section class="export-section"><h2>Interventions</h2>${interventions.length ? `<table class="intervention-table"><thead><tr><th>No.</th>${includeResident ? "<th>Resident</th>" : ""}<th>Date</th><th>Participation</th><th>Hospital</th><th>Senior resident</th><th>Assessor signature</th><th>Notes</th></tr></thead><tbody>${interventionRows}</tbody></table><div class="intervention-summary"><h3>Intervention summary</h3><table><thead><tr><th>Intervention</th><th>Total</th></tr></thead><tbody>${summaryRows}<tr class="summary-total"><td><b>Total interventions</b></td><td><b>${interventions.length}</b></td></tr></tbody></table></div>` : '<div class="empty-logbook">No approved interventions.</div>'}</section>
    <section class="export-section conferences-section"><h2>Conferences</h2>${conferences.length ? `<table class="conference-table"><thead><tr><th>No.</th>${includeResident ? "<th>Resident</th>" : ""}<th>Conference</th><th>Participation</th><th>Date</th><th>Assessor signature</th><th>Notes</th></tr></thead><tbody>${conferenceRows}</tbody></table><p class="section-total"><b>Total conferences:</b> ${conferences.length}</p>` : '<div class="empty-logbook">No approved conferences.</div>'}</section>`;
}
function logbookExportCss() {
  return `@page{size:A4 landscape;margin:10mm}*{box-sizing:border-box}body{margin:0;color:#142033;font-family:Arial,sans-serif;font-size:9px}.resident-page{break-after:page;page-break-after:always}.resident-page:last-child{break-after:auto;page-break-after:auto}header{display:flex;justify-content:space-between;align-items:end;margin-bottom:9px;border-bottom:2px solid #0d4963;padding-bottom:6px}h1{margin:0 0 2px;font-size:18px;color:#081c35}header p,p{margin:0;color:#526174}.export-section{margin-top:12px}.export-section h2{margin:0 0 6px;font-size:13px;color:#0d2d50}.export-section h3{margin:8px 0 4px;font-size:10px}table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{border:1px solid #aebbc8;padding:4px 5px;vertical-align:middle;overflow-wrap:anywhere}th{background:#0d4963;color:white;font-size:8px;text-transform:uppercase;letter-spacing:.2px}tbody tr:not(.procedure-group):nth-child(even){background:#f5f8fb}.procedure-group td{padding:5px 7px;background:#dceaf5;color:#0d2d50;font-weight:800;text-align:left}.procedure-group span{float:right;font-size:8px;color:#526174}.signature{font-family:"Segoe Script","Brush Script MT",cursive;font-size:12px;font-style:italic;color:#153d68;text-align:center}.intervention-summary{width:48%;min-width:330px;margin:8px 0 0 auto}.intervention-summary th:first-child,.intervention-summary td:first-child{text-align:left}.intervention-summary th:last-child,.intervention-summary td:last-child{width:22%;text-align:center}.summary-total td{background:#edf4f9}.section-total{margin-top:6px;text-align:right}.empty-logbook{padding:15px;border:1px dashed #aebbc8;text-align:center;color:#526174}.conferences-section{margin-top:16px;padding-top:10px;border-top:1px solid #ccd7e2}footer{margin-top:6px;text-align:right;color:#6c7886;font-size:8px}`;
}

function printOwnerLogbooks(residentIds = null) {
  if (s.p.role !== "owner") return alert("Owner access required");
  const residents = s.ownerLogbookResidents || [];
  const chosenIds = residentIds ? new Set(residentIds.map(String)) : null;
  const chosenResidents = residents.filter((resident) => chosenIds ? chosenIds.has(String(resident.id)) : true);
  if (!chosenResidents.length) return alert("Select at least one resident to export.");
  const allEntries = s.logbookPrintEntries || [];
  const pages = chosenResidents.map((resident) => {
    const entries = allEntries.filter((entry) => String(entry.resident_id) === String(resident.id) && entry.status === "approved");
    return `<section class="resident-page"><header><div><h1>Approved Resident E-logbook</h1><p>${o(resident.display_name)} · Year ${o(resident.logbook_year || resident.residency_year || "—")}${resident.role && resident.role !== "resident" ? ` · archived ${o(m(resident.role))}` : ""}</p></div><p>${entries.length} approved record${entries.length === 1 ? "" : "s"}</p></header>${logbookExportSections(entries, false)}<footer>Generated ${d(new Date().toISOString())}</footer></section>`;
  }).join("");
  const popup = window.open("", "_blank");
  if (!popup) return alert("Please allow pop-ups to export the PDF.");
  popup.opener = null;
  popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Resident e-logbooks</title><style>${logbookExportCss()}</style></head><body>${pages}</body></html>`);
  popup.document.close();
  popup.focus();
  setTimeout(() => popup.print(), 250);
}
async function resetOwnerLogbooks(residentIds, resetAll = false) {
  if (s.p.role !== "owner") return alert("Owner access required");
  const residents = s.ownerLogbookResidents || [];
  const currentResidents = residents.filter((resident) => resident.role === "resident");
  const ids = resetAll
    ? currentResidents.map((resident) => String(resident.id))
    : residentIds.map(String);
  if (!ids.length) return alert("Select at least one current resident to reset.");
  const chosen = residents.filter((resident) => ids.includes(String(resident.id)));
  if (!resetAll && chosen.some((resident) => resident.role !== "resident")) {
    return alert(
      "Archived former-resident logbooks stay exportable, but reset is limited to accounts whose current role is Resident.",
    );
  }
  const totalEntries = (s.logbookPrintEntries || []).filter((entry) => ids.includes(String(entry.resident_id))).length;
  if (!totalEntries) return alert("The selected resident logbook(s) are already empty.");
  if (resetAll) {
    const typed = prompt(`You are about to reset ALL ${currentResidents.length} current resident logbooks (${totalEntries} activities). This cannot be undone. Type RESET ALL to continue.`);
    if (typed !== "RESET ALL") return;
  } else {
    const names = chosen.slice(0, 5).map((resident) => resident.display_name).join(", ");
    const more = chosen.length > 5 ? ` and ${chosen.length - 5} more` : "";
    if (!confirm(`Reset ${chosen.length} selected resident logbook${chosen.length === 1 ? "" : "s"} (${totalEntries} activities)? ${names}${more}. This cannot be undone.`)) return;
  }
  const resetCount = u(await e.rpc("owner_bulk_reset_logbooks", {
    p_resident_ids: resetAll ? [] : ids,
    p_reset_all: resetAll,
  }));
  await q();
  b(`${resetCount} resident logbook${resetCount === 1 ? "" : "s"} reset successfully`);
  await P();
}
function printApprovedLogbook() {
  const entries = (s.logbookPrintEntries || []).filter((entry) => entry.status === "approved");
  if (!entries.length) return alert("There are no approved logbook entries to export.");
  const residentNames = [...new Set(entries.map((entry) => entry.resident_name))];
  const includeResident = residentNames.length > 1;
  const reportFor = residentNames.length === 1 ? residentNames[0] : "Approved resident activities";
  const popup = window.open("", "_blank");
  if (!popup) return alert("Please allow pop-ups to export the PDF.");
  popup.opener = null;
  popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Approved e-logbook</title><style>${logbookExportCss()}</style></head><body><section class="resident-page"><header><div><h1>Approved Resident E-logbook</h1><p>${o(reportFor)}</p></div><p>${entries.length} approved record${entries.length === 1 ? "" : "s"}</p></header>${logbookExportSections(entries, includeResident)}<footer>Generated ${d(new Date().toISOString())}</footer></section></body></html>`);
  popup.document.close();
  popup.focus();
  setTimeout(() => popup.print(), 250);
}
async function P() {
  t("#title").textContent =
    "resident" === s.p.role
      ? "My logbook"
      : "observer" === s.p.role
        ? "Logbook approvals"
        : "Resident logbooks";
  const requests = [
    e.rpc("get_logbook_entries_v2", {
      p_resident_id: null,
      p_status: null,
      p_activity_category: null,
    }),
  ];
  requests.push(
    "resident" === s.p.role
      ? e.rpc("logbook_approvers")
      : Promise.resolve({ data: [] }),
  );
  requests.push(
    "owner" === s.p.role
      ? e
          .from("profiles")
          .select("id,display_name,residency_year,role")
          .order("display_name")
      : Promise.resolve({ data: [] }),
  );
  const [entriesResult, supervisorsResult, residentsResult] =
    await Promise.all(requests);
  if (entriesResult.error) throw entriesResult.error;
  const entries = entriesResult.data || [];
  const own = entries.filter((entry) => entry.resident_id === s.p.id);
  const assigned = entries.filter(
    (entry) =>
      entry.resident_id !== s.p.id &&
      (entry.senior_resident_id === s.p.id || entry.assessor_id === s.p.id),
  );
  const visible = ("resident" === s.p.role ? own : entries).sort((left, right) => {
    const priority = (item) => item.status === "pending" ? 0 : 1;
    return priority(left) - priority(right) || new Date(right.activity_date) - new Date(left.activity_date);
  });
  s.logbookPrintEntries = visible;
  const approvers = supervisorsResult?.data || [];
  const seniorResidents = approvers.filter(
    (person) => person.approver_group === "senior_resident",
  );
  const assessors = approvers.filter(
    (person) => person.approver_group === "assessor",
  );
  const residents = "owner" === s.p.role
    ? (residentsResult?.data || [])
        .filter(
          (person) =>
            person.role === "resident" ||
            entries.some((entry) => String(entry.resident_id) === String(person.id)),
        )
        .map((person) => {
          const historicalYears = entries
            .filter((entry) => String(entry.resident_id) === String(person.id))
            .map((entry) => Number(entry.residency_year) || 0);
          return {
            ...person,
            logbook_year:
              Number(person.residency_year) || Math.max(0, ...historicalYears) || null,
          };
        })
    : [];
  if (s.p.role === "owner") s.ownerLogbookResidents = residents;
  const ownerLogbookManager =
    "owner" === s.p.role
      ? ` <section class="card no-print owner-logbook-manager"><div class="card-heading"><span class="card-icon">LOG</span><div><h3>Owner logbook management</h3><p>Select residents, export their approved e-logbooks, or reset selected/all logbook data.</p></div></div>
          <div class="owner-logbook-toolbar"><input id="ownerLogbookSearch" type="search" placeholder="Search resident"><div class="owner-logbook-toolbar-actions"><button class="btn secondary" type="button" data-owner-logbook-select-all>Select all</button><button class="btn secondary" type="button" data-owner-logbook-clear>Clear</button></div></div>
          <div id="ownerLogbookResidentList" class="owner-logbook-resident-grid">${residents.map((person) => { const residentEntries = entries.filter((entry) => String(entry.resident_id) === String(person.id)); const approvedCount = residentEntries.filter((entry) => entry.status === "approved").length; const archived = person.role !== "resident"; return `<label class="owner-logbook-resident${archived ? " archived-logbook-owner" : ""}" data-owner-logbook-search="${o(`${person.display_name} year ${person.logbook_year || ""} ${person.role}`.toLowerCase())}"><input class="owner-logbook-resident-check" type="checkbox" value="${person.id}"><span><b>${o(person.display_name)}</b><small>${person.logbook_year ? yearChip(person.logbook_year) : ""} <span>${residentEntries.length} total · ${approvedCount} approved${archived ? ` · archived (${o(m(person.role))})` : ""}</span></small></span></label>`; }).join("") || '<div class="panel-empty">No resident logbooks are available.</div>'}</div>
          <div class="owner-logbook-actions"><div class="owner-logbook-export-actions"><button class="btn" type="button" data-owner-export-selected>Export selected PDF</button><button class="btn secondary" type="button" data-owner-export-all>Export all PDF</button></div><div class="owner-logbook-reset-actions"><button class="btn danger" type="button" data-owner-reset-selected>Reset selected</button><button class="btn danger danger-button" type="button" data-owner-reset-all>Reset ALL logbooks</button></div></div>
          <p class="form-note"><b>Export:</b> official PDF output contains approved activities only, with each resident on a separate page. <b>Reset:</b> permanently clears the chosen resident logbook activities. Accounts, assessments, progress and ordinary Inbox messages are not reset.</p></section>`
      : "";
  const today = new Date();
  today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
  const todayValue = today.toISOString().slice(0, 10);
  const submitCard =
    "resident" === s.p.role
      ? ` <section class="card no-print"> <div class="card-heading"><span class="card-icon">＋</span><div><h3>Record an activity</h3><p>The senior resident receives the request first; the assessor receives it only after senior approval.</p></div></div> <form id="logbookForm" class="form-grid"> <label class="full">Activity type<select name="activity_category" id="logbookCategory" required><option value="manual_intervention">Manual intervention</option><option value="conference">Conference</option></select></label><div class="full form-grid" id="manualFields"><label>Manual intervention<select name="procedure_name" required><option value="">Choose intervention</option>${["CVP", "Intubation", "Temporary pacemaker", "Permanent pacemaker implantation", "Pacemaker programming", "ICD implantation", "CRT implantation", "Pericardiocentesis", "TEE", "DSE", "Coronary angiography", "Elective PCI", "Primary PCI", "IVUS", "Rotablation", "TAVI", "ASD closure", "Mitral balloon valvotomy", "Exercise stress ECG", "Tilting table", "Nuclear imaging", "CT CA", "CMR"].map((item) => `<option>${item}</option>`).join("")}</select></label><fieldset class="choice-field"><legend>Participation</legend><div class="choice-checks participation-options"><label><input type="radio" name="participation_mode" value="attended" required><span>Attended</span></label><label><input type="radio" name="participation_mode" value="failed_trial" required><span>Failed trial</span></label><label><input type="radio" name="participation_mode" value="assisted" required><span>Performed with assistance</span></label><label><input type="radio" name="participation_mode" value="solo_guided" required><span>Performed solo under guidance</span></label><label><input type="radio" name="participation_mode" value="solo_unguided" required><span>Performed solo without guidance</span></label></div></fieldset><label>Activity date<input type="date" name="activity_date" value="${todayValue}" max="${todayValue}" required><small class="date-format-hint">Shown across the site as ${d(todayValue)}</small></label><label>Hospital<select name="hospital" required><option value="">Choose hospital</option><option value="Miri">Miri</option><option value="Smouha">Smouha</option></select></label><label>Senior resident<select name="senior_resident_id" required><option value="">Choose senior resident</option>${seniorResidents.map((person) => `<option value="${person.id}">${o(person.display_name)}</option>`).join("")}</select></label><label>Assessor<select name="assessor_id" required><option value="">Choose assessor</option>${assessors.map((person) => `<option value="${person.id}">${o(person.display_name)}</option>`).join("")}</select></label></div><div class="full form-grid" id="conferenceFields" hidden><label>Conference role<select name="conference_participation" disabled required><option value="attended">Attendee</option><option value="gave_speech">Presenter</option></select></label><label>Conference name<input name="conference_name" minlength="3" maxlength="200" disabled required></label><label>Activity date<input type="date" name="activity_date" value="${todayValue}" max="${todayValue}" disabled required><small class="date-format-hint">Shown across the site as ${d(todayValue)}</small></label><label>Assessor<select name="assessor_id" disabled required><option value="">Choose assessor</option>${assessors.map((person) => `<option value="${person.id}">${o(person.display_name)}</option>`).join("")}</select></label></div><label class="full">Notes / evidence<textarea name="description" placeholder="Optional supporting details"></textarea></label><div class="full form-submit"><button>Submit for approval</button></div></form> </section>`
      : "";
  const pending =
    "resident" === s.p.role
      ? assigned.filter((entry) => "pending" === entry.status)
      : entries.filter(
          (entry) =>
            (entry.senior_resident_id === s.p.id &&
              entry.senior_status === "pending") ||
            (entry.assessor_id === s.p.id &&
              entry.assessor_status === "pending"),
        );
  if (s.p.role === "assessor") {
    a.innerHTML =
      h(
        "Resident logbooks",
        "Filter resident activity by resident, intervention, participation and status. Review pending items directly from the table.",
        '<button class="btn secondary no-print" data-logbook-print>Export PDF</button>',
      ) +
      renderAssessorLogbookTable(visible);
  } else {
    a.innerHTML =
      h(
        "resident" === s.p.role
          ? "Resident e-logbook"
          : "Clinical activity logbooks",
        "resident" === s.p.role
          ? "Record procedures, conference attendance and lectures. Entries become verified after supervisor approval."
          : "Review assigned approval requests and monitor verified resident activity.",
        s.p.role === "owner" ? "" : '<button class="btn secondary no-print" data-logbook-print>Export PDF</button>',
      ) +
      ownerLogbookManager +
      submitCard +
      (pending.length
        ? ` <section class="top-gap"><h2>Approval requests</h2><div class="grid top-gap">${pending.map(B).join("")}</div></section>`
        : "") +
      `<section class="top-gap printable-logbook">${renderLogbookHistoryTable(visible, s.p.role === "resident" ? "resident" : s.p.role)}</section>`;
  }
  const seniorSelect = document.querySelector('select[name="senior_resident_id"]');
  if (seniorSelect) {
    seniorSelect.options[0].textContent = "Choose senior resident";
    [...seniorSelect.options].slice(1).forEach((option) => {
      option.textContent = option.textContent.replace(/\s*·\s*Year\s+[3-5]\s*$/, "");
    });
  }
}
function H() {
  const status = t("#logbookStatus")?.value || "";
  const type = t("#logbookType")?.value || "";
  document
    .querySelectorAll("#logbookEntries [data-logbook-status]")
    .forEach((card) => {
      card.hidden = Boolean(
        (status && card.dataset.logbookStatus !== status) ||
          (type && card.dataset.logbookType !== type),
      );
    });
}
(document.addEventListener("click", async (t) => {
  const a = t.target.closest("button,[data-chapter]");
  if (a) {
    if (
      (a.dataset.go && g(a.dataset.go),
      a.dataset.chapter && g(`chapter:${a.dataset.chapter}`),
      a.dataset.curriculumChapter &&
        g(`curriculum:${a.dataset.curriculumChapter}`),
      a.dataset.curriculumAdd &&
        T(a.dataset.curriculumAdd, a.dataset.chapterId),
      a.dataset.curriculumEdit)
    ) {
      const e = s.curriculumItems.get(a.dataset.curriculumEdit),
        [t] = a.dataset.curriculumEdit.split("~");
      e && T(t, e.chapter_id, e);
    }
    if (a.hasAttribute("data-export-curriculum")) await openCurriculumExport();
    if (a.dataset.curriculumExportSelect) {
      const mode = a.dataset.curriculumExportSelect;
      document.querySelectorAll('#curriculumExportForm input[name="chapter_ids"]').forEach((box) => {
        box.checked = mode === "all" ? true : mode === "none" ? false : box.closest("label")?.dataset.active === "true";
      });
    }
    if (a.dataset.knowledgeBulk) {
      const checked = a.dataset.knowledgeBulk === "all";
      const boxes = [...document.querySelectorAll(".knowledge-progress-checkbox")];
      boxes.forEach((box) => (box.checked = checked));
      if (boxes.length) {
        u(await e.from("knowledge_progress").upsert(boxes.map((box) => ({ resident_id: s.p.id, knowledge_item_id: Number(box.dataset.k), status: checked ? "completed" : "in_progress" })), { onConflict: "resident_id,knowledge_item_id" }));
        b(checked ? "All knowledge points selected" : "All knowledge points deselected");
      }
    }
    if (a.hasAttribute("data-bulk-curriculum")) await openBulkCurriculumPaste();
    if (a.dataset.bulkCurriculumKind) await openBulkCurriculumPaste(a.dataset.bulkCurriculumKind, a.dataset.chapterId);
    if (a.dataset.aiCurriculum) openGuidelineGenerator(a.dataset.aiCurriculum);
    if (a.dataset.curriculumDelete) {
      const [kind, itemId] = a.dataset.curriculumDelete.split("~");
      const title = a.dataset.itemTitle || "this curriculum item";
      if (confirm(`Delete ${title}? If residents already have linked evidence, it will be archived instead of destroying their history.`)) {
        const result = u(await e.rpc("owner_delete_curriculum_item", { p_kind: kind, p_item_id: String(itemId) }));
        b(result === "deleted" ? "Curriculum item deleted" : "Curriculum item archived; resident history preserved");
        await w.curriculum(String(s.curriculumChapter?.id || ""));
      }
    }
    if (a.dataset.resetChapterCurriculum) {
      const chapterTitle = a.dataset.chapterTitle || "this chapter";
      const typed = prompt(`Reset ALL knowledge and skills in ${chapterTitle}? Previous resident evidence will be preserved. Type RESET to continue.`);
      if (typed === "RESET") {
        const result = u(await e.rpc("owner_reset_chapter_curriculum", { p_chapter_id: Number(a.dataset.resetChapterCurriculum) }));
        b(`Chapter reset: ${result?.knowledge || 0} knowledge and ${result?.skills || 0} skills hidden`);
        await w.curriculum(String(a.dataset.resetChapterCurriculum));
      }
    }
    if (a.dataset.reviewSection) {
      const section = a.dataset.reviewSection;
      document.querySelectorAll("[data-review-section]").forEach((tab) => tab.classList.toggle("active", tab.dataset.reviewSection === section));
      document.querySelectorAll("[data-review-panel]").forEach((panel) => {
        panel.hidden = panel.dataset.reviewPanel !== section;
      });
    }
    if (a.dataset.openReviewNotification) {
      const row = window.observerReviewRows?.get(String(a.dataset.openReviewNotification));
      if (!row) return;
      const positive = row.sentiment !== "negative";
      const clinical = row.category !== "attitude";
      const status = String(row.reconsideration_status || "none");
      const own = s.p.role === "resident" && String(row.resident_id) === String(s.p.id);
      y(`<article class="modal review-notification-modal">
        <div class="modal-head"><div><span class="eyebrow">${clinical ? "Clinical review" : "Behavioural review"}</span><h2>${positive ? "👍 Good review" : "👎 Bad review"}</h2></div><button type="button" data-close>×</button></div>
        <div class="review-notification-meta"><b>${o(row.display_observer || row.observer_signature || "Reviewer")}</b><span>${d(row.observed_on)} · ${o(row.place || "—")}</span></div>
        <div class="message-body">${o(row.comment || "No comment")}</div>
        <div class="actions">
          ${own && status === "none" ? `<button class="btn reclaim-button" data-review-reconsider="${o(row.review_id || row.id)}">Request to reconsider</button>` : ""}
          ${own && status === "requested" ? '<span class="tag warning">Reconsideration pending</span>' : ""}
          ${own && status === "accepted" ? '<span class="tag success">Modified after reconsideration</span>' : ""}
          ${own && status === "upheld" ? '<span class="tag neutral">Original review upheld</span>' : ""}
          <button class="btn secondary" type="button" data-close>Close</button>
        </div>
      </article>`);
    }
    if (a.dataset.reviewReconsider) {
      const row = window.observerReviewRows?.get(String(a.dataset.reviewReconsider));
      y(`<form id="reviewReconsiderForm" class="modal"><div class="modal-head"><div><span class="eyebrow">Review reconsideration</span><h2>Request to reconsider</h2></div><button type="button" data-close>×</button></div><p>${o(row?.comment || "Clinical review")}</p><label>Why should this review be reconsidered?<textarea name="justification" maxlength="3000" required></textarea></label><input type="hidden" name="review_id" value="${o(a.dataset.reviewReconsider)}"><div class="actions"><button type="button" class="btn secondary" data-close>Cancel</button><button>Send request</button></div></form>`);
    }
    if (a.dataset.reviewResolve) {
      if (i.open) i.close();
      const row = window.observerReviewRows?.get(String(a.dataset.reviewResolve));
      const decision = a.dataset.reviewDecision;
      if (decision === "accepted") {
        y(`<form id="reviewResolveForm" class="modal review-edit-reconsideration-modal"><div class="modal-head"><div><span class="eyebrow">Reconsideration</span><h2>Accept and edit review</h2></div><button type="button" data-close>×</button></div><div class="review-request-callout"><span>Resident request</span><p>${o(row?.reconsideration_text || "No reason provided")}</p></div><fieldset class="choice-field"><legend>Updated type</legend><div class="review-choice-grid"><label class="review-choice positive"><input type="radio" name="sentiment" value="positive" ${row?.sentiment !== "negative" ? "checked" : ""}><span class="review-choice-icon">👍</span><span><b>Positive</b></span></label><label class="review-choice negative"><input type="radio" name="sentiment" value="negative" ${row?.sentiment === "negative" ? "checked" : ""}><span class="review-choice-icon">👎</span><span><b>Negative</b></span></label></div></fieldset><label class="review-updated-comment">Updated comment<textarea name="comment" minlength="10" required>${o(row?.comment || "")}</textarea></label><div class="review-original-comment"><span>Original comment</span><p>${o(row?.comment || "—")}</p></div><input type="hidden" name="review_id" value="${o(a.dataset.reviewResolve)}"><input type="hidden" name="decision" value="accepted"><div class="actions"><button type="button" class="btn secondary" data-close>Cancel</button><button>Save modified review</button></div></form>`);
      } else {
        y(`<form id="reviewResolveForm" class="modal"><div class="modal-head"><div><span class="eyebrow">Reconsideration</span><h2>Keep original review</h2></div><button type="button" data-close>×</button></div><div class="review-workflow"><p><b>Resident request:</b> ${o(row?.reconsideration_text || "")}</p><p><b>Original review:</b> ${o(row?.comment || "")}</p></div><label>Response note<textarea name="note" minlength="2" required placeholder="Explain why the original review remains appropriate"></textarea></label><input type="hidden" name="review_id" value="${o(a.dataset.reviewResolve)}"><input type="hidden" name="decision" value="upheld"><input type="hidden" name="comment" value="${o(row?.comment || "")}"><input type="hidden" name="sentiment" value="${o(row?.sentiment || "positive")}"><div class="actions"><button type="button" class="btn secondary" data-close>Cancel</button><button class="danger-button">Keep original review</button></div></form>`);
      }
    }
    if ((a.hasAttribute("data-schedule-add") && O(), a.dataset.scheduleEdit)) {
      const e = s.schedules.get(a.dataset.scheduleEdit);
      e && O(e);
    }
    if (a.dataset.manageAccount) {
      const person = s.accountUsers.get(String(a.dataset.manageAccount));
      person && openAccountManagement(person);
    }
    if (a.hasAttribute("data-owner-logbook-select-all")) {
      document.querySelectorAll("[data-owner-logbook-search]:not([hidden]) .owner-logbook-resident-check").forEach((box) => (box.checked = true));
    }
    if (a.hasAttribute("data-owner-logbook-clear")) {
      document.querySelectorAll(".owner-logbook-resident-check").forEach((box) => (box.checked = false));
    }
    if (a.hasAttribute("data-owner-export-selected")) {
      printOwnerLogbooks(ownerSelectedLogbookResidentIds());
    }
    if (a.hasAttribute("data-owner-export-all")) {
      printOwnerLogbooks(null);
    }
    if (a.hasAttribute("data-owner-reset-selected")) {
      await resetOwnerLogbooks(ownerSelectedLogbookResidentIds(), false);
    }
    if (a.hasAttribute("data-owner-reset-all")) {
      await resetOwnerLogbooks([], true);
    }
    if (a.dataset.openTestReset) {
      openOwnerTestResetConfirmation(a.dataset.openTestReset);
    }
    if (a.dataset.auditReset) {
      openOwnerInterventionAuditReset(a.dataset.auditReset);
    }
    if (a.hasAttribute("data-audit-modal-select-all")) {
      document.querySelectorAll('#ownerAuditResetForm input[name="resident_ids"]').forEach((box) => (box.checked = true));
    }
    if (a.hasAttribute("data-audit-modal-clear")) {
      document.querySelectorAll('#ownerAuditResetForm input[name="resident_ids"]').forEach((box) => (box.checked = false));
    }
    var r, d;
    if (
      (a.dataset.log &&
        y(
          ` <form id="logForm" class="modal"> <div class="modal-head"><h2>${o(a.dataset.name)}</h2><button type="button" data-close>×</button></div> <label>Date<input type="date" name="performed_on" value="${new Date().toISOString().slice(0, 10)}" required></label> <label>Supervising senior<input name="supervisor_name" required></label> <label>Notes<textarea name="notes"></textarea></label> <input type="hidden" name="skill_id" value="${a.dataset.log}"> <div class="actions"><button>Save performance</button></div> </form>`,
        ),
      a.dataset.review &&
        ((r = a.dataset.review),
        (d = a.dataset.name),
        y(
          ` <form id="reviewForm" class="modal"> <div class="modal-head"><div><span class="eyebrow">Clinical / behavioural review</span><h2>Review ${o(d)}</h2></div><button type="button" data-close>×</button></div> <div class="form-grid"> <label>Observation area<select name="category"><option value="knowledge">Clinical · Knowledge</option><option value="skill">Clinical · Skill</option><option value="attitude">Behavioural</option></select></label> <label>Date<input type="date" name="observed_on" value="${new Date().toISOString().slice(0, 10)}" required></label> <label class="full">Place<input name="place" required></label> <fieldset class="full choice-field"><legend>Comment type</legend><div class="review-choice-grid"><label class="review-choice positive"><input type="radio" name="sentiment" value="positive" checked required><span class="review-choice-icon">👍</span><span><b>Positive</b><small>Good performance / reinforcement</small></span></label><label class="review-choice negative"><input type="radio" name="sentiment" value="negative" required><span class="review-choice-icon">👎</span><span><b>Negative</b><small>Concern / point needing improvement</small></span></label></div></fieldset> <fieldset class="full choice-field"><legend>Identity</legend><div class="review-choice-grid"><label class="review-choice"><input type="radio" name="identity_mode" value="named" checked required><span class="review-choice-icon">👤</span><span><b>Show my name</b><small>Resident and assessor can see who wrote it</small></span></label><label class="review-choice"><input type="radio" name="identity_mode" value="anonymous" required><span class="review-choice-icon">◉</span><span><b>Anonymous</b><small>Your name is hidden from resident and assessor; owner can still audit it</small></span></label></div></fieldset> <label class="full">Comment<textarea name="comment" minlength="10" required></textarea></label> </div> <input type="hidden" name="resident_id" value="${r}"> <div class="actions"><button type="button" class="btn secondary" data-close>Cancel</button><button>Submit review</button></div> </form>`,
        )),
      a.dataset.candidate && g(`candidate:${a.dataset.candidate}`),
      a.dataset.assess &&
        (async function (t, a, i, r, n) {
          const { data: d } = await e
            .from("assessment_deduction_reasons")
            .select("*")
            .eq("is_active", !0);
          ((s.reasons = d || []),
            y(
              ` <form id="assessmentForm" class="modal"> <div class="modal-head"><h2>Assess ${o(a)}</h2><button type="button" data-close>×</button></div> ${[
                ["knowledge", 6],
                ["skills", 7],
                ["attitude", 8],
              ]
                .map(
                  ([e, t]) =>
                    ` <section class="item assessment-domain"> <h3>${e} <small>pass ${t}/10</small></h3> <input name="${e}_score" type="number" min="0" max="10" step=".5" value="10" required> ${s.reasons
                      .filter((s) => s.domain === e)
                      .map(
                        (s) =>
                          ` <label class="check-line reason-check"><input class="auto-width" type="checkbox" name="${e}_reasons" value="${s.id}"><span>${o(s.label)}</span></label>`,
                      )
                      .join(
                        "",
                      )} <textarea name="${e}_justification" placeholder="Justification when marks are deducted"></textarea> </section>`,
                )
                .join(
                  "",
                )} <input type="hidden" name="resident_id" value="${t}"> <input type="hidden" name="chapter_id" value="${i || ""}"> <input type="hidden" name="schedule_id" value="${r}"> <input type="hidden" name="assessment_type" value="${n}"> <div class="actions"><button>Submit final assessment</button></div> </form>`,
            ));
        })(
          a.dataset.assess,
          a.dataset.name,
          a.dataset.cid,
          a.dataset.scheduleId,
          a.dataset.assessmentType,
        ),
      a.hasAttribute("data-create") &&
        (y(
          ` <form id="accountForm" class="modal"> <div class="modal-head"><h2>Create account</h2><button type="button" data-close>×</button></div> <div class="form-grid"> <label>Full professional name<input name="display_name" required></label> <label>Username<input name="username" pattern="[A-Za-z0-9._\-]{3,40}" required></label> <label class="full">Email<input type="email" name="email" required></label> <label>Role <select name="role" id="accountRole"> <option value="resident">Resident</option> <option value="observer">Observer</option> <option value="assessor">Assessor</option> </select> </label> <label id="accountYearField">Residency year <select name="residency_year" required>${n.map((e) => `<option value="${e}">Year ${e}</option>`).join("")}</select> </label> <label class="full">Initial password<input type="password" name="password" minlength="8" required></label> </div> <p class="form-note">Assessor years are assigned later from the Assessor Assignments page.</p> <div class="actions"><button type="button" class="btn secondary" data-close>Cancel</button><button>Create account</button></div> </form>`,
        ),
        E()),
      a.hasAttribute("data-compose-message") && openComposer(),
      a.hasAttribute("data-retry-reviews") && (async () => { await w.reviews(); })(),
      a.dataset.mailTab && (() => {
        document.querySelectorAll("[data-mail-tab]").forEach((tab) => tab.classList.toggle("active", tab.dataset.mailTab === a.dataset.mailTab));
        document.querySelectorAll("[data-mail-panel]").forEach((panel) => panel.hidden = panel.dataset.mailPanel !== a.dataset.mailTab);
        const search = t("#messageSearch");
        const category = t("#messageCategoryFilter");
        const selectVisible = t("#selectVisibleMessages");
        if (search) search.value = "";
        if (category) category.value = "";
        if (selectVisible) selectVisible.checked = false;
        filterPrivateMessageRows();
        syncPrivateMailboxControls();
      })(),
      a.dataset.logbookTab && (() => {
        document.querySelectorAll("[data-logbook-tab]").forEach((tab) => tab.classList.toggle("active", tab.dataset.logbookTab === a.dataset.logbookTab));
        document.querySelectorAll("[data-mail-panel]").forEach((panel) => panel.hidden = panel.dataset.mailPanel !== a.dataset.logbookTab);
        const bulk = document.querySelector(".logbook-bulk-actions");
        if (bulk) bulk.hidden = a.dataset.logbookTab === "reconsiderations";
        const search = t("#messageSearch");
        if (search) { search.value = ""; search.dispatchEvent(new Event("input", { bubbles: true })); }
      })(),
      a.hasAttribute("data-mark-all-read") && (async () => {
        u(await e.rpc("mark_all_private_messages_read"));
        await q();
        await inboxPage();
        b("All Inbox messages marked as read");
      })(),
      a.hasAttribute("data-trash-selected") && (async () => {
        const panel=document.querySelector('[data-mail-panel]:not([hidden])');
        const box=panel?.dataset.mailPanel;
        if(!["inbox","sent"].includes(box)) return alert("Choose Inbox or Sent");
        const ids=[...new Set([...panel.querySelectorAll('.message-select:checked')].flatMap((x)=>String(x.dataset.messageIds || x.value).split(",").map((v)=>Number(v)).filter(Boolean)))];
        if(!ids.length) return alert("Select at least one message");
        u(await e.rpc("move_private_messages_to_trash",{p_message_ids:ids,p_box:box})); await inboxPage(); b("Messages moved to Trash");
      })(),
      a.hasAttribute("data-restore-selected") && (async () => {
        const ids=[...document.querySelectorAll('[data-mail-panel="trash"] .message-select:checked')].map(x=>Number(x.value));
        if(!ids.length) return alert("Select at least one message");
        u(await e.rpc("restore_private_messages",{p_message_ids:ids})); await inboxPage(); b("Messages restored");
      })(),
      a.hasAttribute("data-delete-forever") && (async () => {
        const ids=[...document.querySelectorAll('[data-mail-panel="trash"] .message-select:checked')].map(x=>Number(x.value));
        if(!ids.length) return alert("Select at least one message");
        if(!confirm("Delete selected messages forever? This cannot be undone.")) return;
        u(await e.rpc("permanently_delete_private_messages",{p_message_ids:ids})); await inboxPage(); b("Messages permanently deleted");
      })(),
      a.hasAttribute("data-empty-trash") && (async () => {
        if(!confirm("Empty Trash permanently? This cannot be undone.")) return;
        u(await e.rpc("empty_private_message_trash")); await inboxPage(); b("Trash emptied");
      })(),
      a.hasAttribute("data-hide-logbook-selected") && (async () => {
        const panel = document.querySelector('[data-mail-panel]:not([hidden])');
        const ids = [...(panel?.querySelectorAll(".logbook-message-select:checked") || [])].map((box) => Number(box.value));
        if (!ids.length) return alert("Select at least one logbook message");
        if (!confirm(`Delete ${ids.length} selected message cop${ids.length === 1 ? "y" : "ies"} from your view? The resident My logbook record will remain unchanged.`)) return;
        u(await e.rpc("hide_logbook_messages", { p_message_ids: ids }));
        await logbookRequestsPage();
        b(`${ids.length} logbook message cop${ids.length === 1 ? "y" : "ies"} removed from your view`);
      })(),
      a.hasAttribute("data-cleanup-delete-all") && (async () => {
        const summary = u(await e.rpc("owner_message_cleanup_summary")) || [];
        const total = Number(summary.find((row) => row.category === "all")?.message_count || 0);
        if (!total) return alert("There are no messages to delete.");
        if (!confirm(`Delete ALL ${total} program messages? This removes Inbox/Sent message records for all users. Resident My logbook records and exported logbook data will remain unchanged.`)) return;
        const count = u(await e.rpc("owner_cleanup_message_categories", { p_categories: [], p_delete_all: true }));
        await q();
        b(`${count} message${count === 1 ? "" : "s"} deleted. Resident logbooks were not changed.`);
        await ownerMessageCleanupPage();
      })(),
      a.hasAttribute("data-logbook-print") && printApprovedLogbook(),
      a.dataset.reclaimLogbook && openLogbookReclaim(
        a.dataset.reclaimLogbook,
        a.dataset.logbookTitle,
        a.dataset.reclaimReviewer,
        a.dataset.reclaimReviewerId,
      ),
      a.dataset.logbookDetail && openLogbookEntryDetail(window.logbookEntryRows?.get(String(a.dataset.logbookDetail))),
      a.dataset.logbookTableReview &&
        openLogbookDecision(
          a.dataset.logbookTableReview,
          a.dataset.logbookTitle,
        ),
      a.dataset.inlineLogbookReconsideration &&
        (async () => {
          const panel = a.closest(".embedded-reconsideration");
          const note = String(panel?.querySelector("[data-reconsideration-note]")?.value || "").trim();
          if (!note) return alert("Write a short decision note before approving or rejecting the reconsideration.");
          const decision = a.dataset.reconsiderationDecision;
          if (!['approved','rejected'].includes(decision)) return;
          const originalText = a.textContent;
          a.disabled = true;
          a.textContent = decision === 'approved' ? 'Approving…' : 'Rejecting…';
          try {
            const finalStatus = u(await e.rpc("resolve_logbook_reconsideration_v1044", {
              p_reconsideration_id: a.dataset.inlineLogbookReconsideration,
              p_decision: decision,
              p_note: note,
            }));
            await q();
            b(`${decision === "approved" ? "Reconsideration approved" : "Reconsideration rejected"} · final logbook status: ${finalStatus || "updated"}`);
            await logbookRequestsPage();
          } catch (error) {
            alert(error.message || "Unable to resolve reconsideration");
            a.disabled = false;
            a.textContent = originalText;
          }
        })(),
      a.hasAttribute("data-open-logbook-reconsideration") && (() => {
        i.open && i.close();
        g("logbook-requests");
      })(),
      a.dataset.logbookReconsiderationResolve &&
        openLogbookReconsiderationDecision(
          window.logbookReconsiderationRows?.get(String(a.dataset.logbookReconsiderationResolve)),
          a.dataset.reconsiderationDecision,
        ),
      a.dataset.logbookReview &&
        openLogbookDecision(
          a.dataset.logbookReview,
          a.dataset.logbookTitle,
        ),
      a.dataset.inboxLogbookReview &&
        openLogbookDecision(
          a.dataset.inboxLogbookReview,
          a.dataset.logbookTitle,
          a.dataset.approvalMessageId,
        ),
      a.dataset.inboxLogbookReject &&
        openLogbookDecision(
          a.dataset.inboxLogbookReject,
          a.dataset.logbookTitle,
          a.dataset.approvalMessageId,
          "rejected",
        ),
      a.dataset.quickLogbookApprove &&
        (async () => {
          u(await e.rpc("review_logbook_entry_v1051", {
            p_entry_id: a.dataset.quickLogbookApprove,
            p_decision: "approved",
            p_note: "Approved",
          }));
          await q();
          if (a.closest(".wide-mailbox") && location.hash === "#inbox") await inboxPage();
          else await logbookRequestsPage();
        })(),
      a.dataset.reconsiderApprove && (async () => {
        const finalStatus = u(await e.rpc("resolve_logbook_reconsideration", {
          p_message_id: Number(a.dataset.reconsiderMessageId),
          p_entry_id: a.dataset.reconsiderApprove,
          p_decision: "approved",
          p_note: "Approved after reconsideration",
        }));
        i.close();
        await q();
        await inboxPage();
        b(`Reconsideration approved · logbook status: ${finalStatus || "updated"}`);
      })(),
      a.dataset.reconsiderReject && (async () => {
        const finalStatus = u(await e.rpc("resolve_logbook_reconsideration", {
          p_message_id: Number(a.dataset.reconsiderMessageId),
          p_entry_id: a.dataset.reconsiderReject,
          p_decision: "rejected",
          p_note: "Request to reconsider rejected",
        }));
        i.close();
        await q();
        await inboxPage();
        b(`Reconsideration rejected · logbook status: ${finalStatus || "rejected"}`);
      })(),
      a.dataset.reviewThread &&
        (async () => {
          const thread = window.reviewInboxThreads?.get(String(a.dataset.reviewThread));
          if (!thread) return;
          const unread = thread.messages.filter((message) => !message.is_read);
          if (unread.length) {
            await Promise.all(unread.map((message) => e.rpc("mark_private_message_read", { p_message_id: String(message.id) })));
            unread.forEach((message) => { message.is_read = true; });
            await q();
            if (location.hash === "#inbox") await inboxPage();
          }
          y(renderReviewThreadTimeline(thread));
        })(),
      a.dataset.messageId &&
        (async () => {
          const isLogbook = a.dataset.messageBox?.startsWith("logbook");
          const key = isLogbook
            ? `${a.dataset.messageBox}-${a.dataset.messageId}`
            : a.dataset.messageBox === "sent" ? `sent-${a.dataset.messageId}` : a.dataset.messageBox === "trash" ? `trash-${a.dataset.messageId}` : a.dataset.messageId;
          const message = isLogbook ? window.logbookMessages?.get(String(key)) : window.residentMessages?.get(String(key));
          if (!message) return;
          if ((a.dataset.messageBox === "inbox" || a.dataset.messageBox === "logbook") && !message.is_read) {
            await e.rpc("mark_private_message_read", {
              p_message_id: String(message.id),
            });
            message.is_read = true;
            const row = a.closest(".message-row");
            row?.classList.remove("unread");
            row?.classList.add("read");
            await q();
          }
          const reconsiderationRequest = a.dataset.messageBox === "inbox" &&
            isReconsiderationRequest(message) &&
            Boolean(message.logbook_entry_id) &&
            s.p.role !== "owner";
          let reviewReconsideration = null;
          if (a.dataset.messageBox === "inbox" && message.subject === "Review reconsideration requested" && ["observer", "assessor"].includes(s.p.role)) {
            const linked = await e.rpc("get_review_reconsideration_for_message_v1041", { p_message_id: String(message.id) });
            if (!linked.error && linked.data) {
              reviewReconsideration = linked.data;
              window.observerReviewRows ||= new Map();
              window.observerReviewRows.set(String(reviewReconsideration.id), reviewReconsideration);
            }
          }
          const decisionTitle = message.subject === "Reconsideration approved"
            ? `<span class="decision-title reconsideration-approved-title"><span class="decision-icon-pair" aria-label="Approved after reconsideration"><span class="decision-icon approved">✓</span><span class="after-reconsideration-badge" title="After reconsideration" aria-hidden="true">💡</span></span><span>${o(message.subject)}</span></span>`
            : message.subject === "Logbook approval"
              ? `<span class="decision-title"><span class="decision-icon approved">✓</span><span>${o(message.subject)}</span></span>`
            : message.subject === "Logbook rejection" || message.subject === "Reconsideration rejected"
              ? `<span class="decision-title"><span class="decision-icon rejected">×</span><span>${o(message.subject)}</span></span>`
              : reconsiderationRequest
                ? `<span class="decision-title"><span class="decision-icon reconsider">↺</span><span>Request to reconsider</span></span>`
                : o((message.subject || "No subject").replace(/\bReclaim\b/gi, "Request to reconsider"));
          const approvalActions = a.dataset.messageBox === "logbook"
            ? window.logbookInboxButtons?.(message, "modal") || ""
            : "";
          const reconsiderationActions = reconsiderationRequest
            ? `<div class="reconsideration-decision"><p><b>Logbook reconsideration</b><br><small>The resident's request is attached to the original logbook request. Open it there to see the intervention, reason, original decision and enter the required decision note.</small></p><div class="approval-actions"><button class="btn" data-open-logbook-reconsideration>Open original request</button></div></div>`
            : "";
          const reviewReconsiderationActions = reviewReconsideration
            ? `<div class="reconsideration-decision review-reconsideration-decision"><p><b>Review reconsideration</b><br><small>Accepting opens the review for modification. After saving, both the resident and assigned assessor will see it as <b>Modified</b>.</small></p><div class="approval-actions"><button class="btn success-button" data-review-resolve="${o(reviewReconsideration.id)}" data-review-decision="accepted">Accept & modify review</button><button class="btn secondary" data-review-resolve="${o(reviewReconsideration.id)}" data-review-decision="upheld">Keep original</button></div></div>`
            : "";
          const incoming = a.dataset.messageBox === "inbox" || a.dataset.messageBox === "logbook";
          const linkedReview = a.dataset.messageBox === "inbox" ? window.inboxReviewActions?.get(String(message.id)) : null;
          const renderedMessageBody = reviewReconsideration
            ? reviewReconsiderationMessage(message, reviewReconsideration)
            : linkedReview
              ? linkedReviewMessage(message, linkedReview)
              : `<div class="message-body">${messageBody(message)}</div>`;
          y(
            `<article class="modal message-view"><div class="modal-head"><div><span class="eyebrow">${incoming ? "From" : "To"} ${o(incoming ? message.sender_name : message.receiver_name)}</span><h2>${decisionTitle}</h2></div><button type="button" data-close>×</button></div><small>${l(message.created_at)}</small>${renderedMessageBody}${reconsiderationActions}${reviewReconsiderationActions}${incoming ? `<div class="actions">${approvalActions}${isLogbook ? "" : `<button class="btn secondary" data-reply-to="${message.sender_id}">Reply</button>`}</div>` : ""}</article>`,
          );
        })(),
      a.dataset.replyTo && (i.close(), openComposer(a.dataset.replyTo)),
      a.hasAttribute("data-close") && i.close(),
      a.dataset.status)
    ) {
      const { error: s } = await e.functions.invoke("admin-users", {
        body: {
          action: "set_status",
          user_id: a.dataset.status,
          is_active: "true" === a.dataset.active,
        },
      });
      s ? alert(s.message) : $();
    }
    if (a.dataset.upgrade && confirm(`Upgrade ${a.dataset.name}?`)) {
      const { error: s } = await e.rpc("owner_upgrade_resident", {
        p_resident_id: a.dataset.upgrade,
      });
      s ? alert(s.message) : $();
    }
  }
}),
  document.addEventListener("change", async (t) => {
    const a = t.target;
    if (a.dataset.k) {
      const { error: t } = await e.from("knowledge_progress").upsert(
        {
          resident_id: s.p.id,
          knowledge_item_id: +a.dataset.k,
          status: a.checked ? "completed" : "in_progress",
        },
        { onConflict: "resident_id,knowledge_item_id" },
      );
      t ? alert(t.message) : b("Knowledge updated");
    }
    if (a.dataset.level) {
      const skillId = Number(a.dataset.level);
      if (a.checked) {
        document.querySelectorAll(`input[data-level="${skillId}"]`).forEach((box) => {
          if (box !== a) box.checked = false;
        });
        const { error: levelError } = await e.from("skill_levels").upsert(
          { resident_id: s.p.id, skill_id: skillId, level: Number(a.value) },
          { onConflict: "resident_id,skill_id" },
        );
        levelError ? alert(levelError.message) : b(`Level ${a.value} selected`);
      } else {
        const { error: levelError } = await e.rpc("clear_my_skill_level_v1049", { p_skill_id: String(skillId) });
        levelError ? alert(levelError.message) : b("Skill level cleared");
      }
    }
    if (a.id === "cleanupSelectAll") {
      document.querySelectorAll('#ownerMessageCleanupForm input[name="categories"]').forEach((box) => {
        box.checked = a.checked;
      });
    }
    if (a.id === "editAccountRole") syncEditAccountYearField();
    if (a.id === "accountRoleFilter") filterAccountRows();
    ("findYear" === a.id && R(),
      ("logbookStatus" === a.id || "logbookType" === a.id) && H(),
      a.matches?.("[data-review-filter]") && filterReviewTable(a.closest(".review-table-card")),
      a.matches?.("[data-logbook-history-filter]") && filterLogbookHistoryTable(a.closest(".logbook-history-table-card")),
      (["assessorLogbookResidentFilter","assessorLogbookActivityFilter","assessorLogbookCategoryFilter","assessorLogbookParticipationFilter","assessorLogbookStatusFilter"].includes(a.id)) && filterAssessorLogbookTable(),
      ("requestResidentFilter" === a.id || "requestStatusFilter" === a.id || "requestTypeFilter" === a.id) && filterLogbookRequestRows(),
      ("auditYearFilter" === a.id || "auditProcedureFilter" === a.id) && renderOwnerInterventionAudit(),
      "messageCategoryFilter" === a.id && filterPrivateMessageRows(),
      "selectVisibleMessages" === a.id && (() => {
        const panel = document.querySelector('[data-mail-panel]:not([hidden])');
        panel?.querySelectorAll(".message-row:not([hidden]) .message-select").forEach((box) => {
          box.checked = a.checked;
        });
        filterPrivateMessageRows();
      })(),
      a.classList.contains("message-select") && (t("#requestResidentFilter") ? filterLogbookRequestRows() : filterPrivateMessageRows()),
      "selectVisibleLogbookMessages" === a.id && (() => {
        const panel = document.querySelector('[data-mail-panel]:not([hidden])');
        panel?.querySelectorAll(".message-row:not([hidden]) .logbook-message-select").forEach((box) => {
          box.checked = a.checked;
        });
        filterLogbookRequestRows();
      })(),
      a.dataset.aiSelectAll && (() => {
        const form = a.closest("#aiCurriculumImportForm");
        const selector = a.dataset.aiSelectAll === "knowledge" ? 'input[name="knowledge_indices"]' : 'input[name="skill_indices"]';
        form?.querySelectorAll(selector).forEach((box) => { box.checked = a.checked; });
      })(),
      "logbookDecision" === a.id && (() => {
        const note = document.querySelector('#logbookReviewForm textarea[name="note"]');
        const hint = document.querySelector("#logbookNoteHint");
        const rejected = a.value === "rejected";
        note.required = rejected;
        hint.textContent = rejected ? "Required for rejection" : "Optional (defaults to Approved)";
      })(),
      "logbookCategory" === a.id &&
        (() => {
          const conference = a.value === "conference";
          const manualFields = document.querySelector("#manualFields");
          const conferenceFields = document.querySelector("#conferenceFields");
          manualFields.hidden = conference;
          conferenceFields.hidden = !conference;
          manualFields
            .querySelectorAll("input,select,textarea")
            .forEach((field) => (field.disabled = conference));
          conferenceFields
            .querySelectorAll("input,select,textarea")
            .forEach((field) => (field.disabled = !conference));
        })(),
      "recipientScope" === a.id && (() => {
        const peopleField = t("#recipientPeopleField");
        const yearField = t("#recipientYearField");
        const needsPeople = ["selected_people", "selected_assessors", "selected_residents"].includes(a.value);
        if (peopleField) peopleField.hidden = !needsPeople;
        if (yearField) yearField.hidden = a.value !== "year_residents";
        const select = peopleField?.querySelector("select");
        if (select) Array.from(select.options).forEach((option) => {
          option.hidden = a.value === "selected_assessors" ? option.dataset.role !== "assessor" : a.value === "selected_residents" ? option.dataset.role !== "resident" : false;
          if (option.hidden) option.selected = false;
        });
      })(),
      "accountRole" === a.id && E(),
      "scheduleYear" === a.id && Y());
  }),
  document.addEventListener("input", (e) => {
    "findResident" === e.target.id &&
      (clearTimeout(window.residentSearchTimer),
      (window.residentSearchTimer = setTimeout(R, 250)));
    if (e.target.matches?.("[data-review-filter]")) filterReviewTable(e.target.closest(".review-table-card"));
    if (e.target.matches?.("[data-logbook-history-filter]")) filterLogbookHistoryTable(e.target.closest(".logbook-history-table-card"));
    if (e.target.id === "ownerLogbookSearch") filterOwnerLogbookResidents();
    if (e.target.id === "accountSearch") filterAccountRows();
    if (e.target.id === "assessorLogbookResidentSearch") {
      filterAssessorLogbookTable();
      return;
    }
    if (e.target.id === "auditResidentSearch") renderOwnerInterventionAudit();
    if (e.target.id === "messageSearch") {
      if (t("#requestResidentFilter")) return filterLogbookRequestRows();
      filterPrivateMessageRows();
    }
  }),
  document.addEventListener("submit", async (t) => {
    t.preventDefault();
    const a = t.target,
      r = new FormData(a);
    try {
      if (
        ("logForm" === a.id &&
          u(
            await e.from("skill_logs").insert({
              resident_id: s.p.id,
              skill_id: +r.get("skill_id"),
              performed_on: r.get("performed_on"),
              supervisor_name: r.get("supervisor_name"),
              notes: r.get("notes") || null,
            }),
          ),
        "accountForm" === a.id)
      ) {
        const s = Object.fromEntries(r);
        ((s.role = r.get("role")),
          (s.residency_year =
            "resident" === s.role ? Number(r.get("residency_year")) : null));
        const { data: t, error: a } = await e.functions.invoke("admin-users", {
          body: { action: "create_user", ...s },
        });
        if (a) throw a;
        if (t?.error) throw new Error(t.error);
      }
      if ("curriculumExportForm" === a.id) {
        const ids = r.getAll("chapter_ids").map(Number);
        if (!ids.length) throw new Error("Choose at least one chapter");
        i.close();
        await printCurriculumPdf(ids);
        return;
      }
      if ("reviewForm" === a.id) {
        u(await e.rpc("submit_observer_review_v2", {
          p_resident_id: r.get("resident_id"),
          p_category: r.get("category"),
          p_observed_on: r.get("observed_on"),
          p_place: r.get("place"),
          p_comment: r.get("comment"),
          p_sentiment: r.get("sentiment"),
          p_is_anonymous: r.get("identity_mode") === "anonymous",
        }));
        i.close();
        b("Review submitted and the resident and Program Owner were notified");
        return void g(s.p.role === "assessor" ? "write-review" : "reviews");
      }
      if ("reviewReconsiderForm" === a.id) {
        u(await e.rpc("resident_request_review_reconsideration", {
          p_review_id: String(r.get("review_id")),
          p_justification: r.get("justification"),
        }));
        i.close();
        b("Request to reconsider sent to the reviewer and Program Owner");
        return void (await w.reviews());
      }
      if ("reviewResolveForm" === a.id) {
        u(await e.rpc("reviewer_resolve_review_reconsideration", {
          p_review_id: String(r.get("review_id")),
          p_decision: r.get("decision"),
          p_comment: r.get("comment") || null,
          p_sentiment: r.get("sentiment") || null,
          p_note: r.get("note") || null,
        }));
        i.close();
        await q();
        b(r.get("decision") === "accepted" ? "Reconsideration accepted and review updated" : "Original review upheld");
        if (s.p.role === "assessor") return void (await reviewPage());
        return void (await w.reviews());
      }
      if ("ownerAccountEditForm" === a.id) {
        const role = String(r.get("role") || "");
        const year = role === "resident" ? Number(r.get("residency_year")) : null;
        const result = u(await e.rpc("owner_update_account_assignment", {
          p_user_id: r.get("user_id"),
          p_role: role,
          p_residency_year: year,
        }));
        i.close();
        b(`Account updated to ${m(role)}${role === "resident" ? ` · Year ${year}` : ""}`);
        return void (await w.users());
      }
      if (a.classList.contains("assessor-year-form")) {
        const s = r.getAll("years").map(Number);
        return (
          u(
            await e.rpc("owner_set_assessor_years", {
              p_assessor_id: r.get("assessor_id"),
              p_years: s,
            }),
          ),
          b(`Assignments saved for ${a.dataset.assessorName}`),
          void (await j())
        );
      }

      if ("bulkCurriculumForm" === a.id) {
        const chapters = u(await e.from("chapters").select("id,title,year_from,year_to,sort_order").order("year_from").order("sort_order")) || [];
        const fixedKind = String(r.get("bulk_kind") || "");
        const fixedChapterId = String(r.get("bulk_chapter_id") || "");
        const parsed = parseBulkCurriculumRows(r.get("bulk_text"), chapters, fixedKind, fixedChapterId, Number(r.get("default_level")) || 3);
        if (parsed.errors.length) throw new Error(`Please fix the pasted rows:\n${parsed.errors.slice(0, 8).join("\n")}${parsed.errors.length > 8 ? `\n…and ${parsed.errors.length - 8} more.` : ""}`);
        if (!parsed.rows.length) throw new Error("No valid curriculum rows were found.");
        const [knowledgeExisting, skillsExisting] = await Promise.all([
          e.from("knowledge_items").select("chapter_id,title,sort_order").eq("is_active", true),
          e.from("skills").select("chapter_id,title,sort_order").eq("is_active", true),
        ]).then((results) => results.map(u));
        const maxKnowledge = new Map(), maxSkills = new Map(), existingKnowledge = new Set(), existingSkills = new Set();
        (knowledgeExisting || []).forEach((item) => {
          const id = Number(item.chapter_id);
          maxKnowledge.set(id, Math.max(maxKnowledge.get(id) || 0, Number(item.sort_order) || 0));
          existingKnowledge.add(`${id}~${normalizeBulkText(item.title)}`);
        });
        (skillsExisting || []).forEach((item) => {
          const id = Number(item.chapter_id);
          maxSkills.set(id, Math.max(maxSkills.get(id) || 0, Number(item.sort_order) || 0));
          existingSkills.add(`${id}~${normalizeBulkText(item.title)}`);
        });
        const skipDuplicates = r.get("skip_duplicates") === "on";
        const seenKnowledge = new Set(), seenSkills = new Set();
        const knowledgeRows = [], skillRows = [];
        let skipped = 0;
        parsed.rows.forEach((item) => {
          const key = `${item.chapter_id}~${normalizeBulkText(item.title)}`;
          if (item.kind === "knowledge") {
            if ((skipDuplicates && existingKnowledge.has(key)) || seenKnowledge.has(key)) { skipped += 1; return; }
            seenKnowledge.add(key);
            const nextOrder = (maxKnowledge.get(item.chapter_id) || 0) + 10;
            maxKnowledge.set(item.chapter_id, nextOrder);
            knowledgeRows.push({ chapter_id: item.chapter_id, title: item.title, description: item.description || null, sort_order: nextOrder, is_active: true });
          } else {
            if ((skipDuplicates && existingSkills.has(key)) || seenSkills.has(key)) { skipped += 1; return; }
            seenSkills.add(key);
            const nextOrder = (maxSkills.get(item.chapter_id) || 0) + 10;
            maxSkills.set(item.chapter_id, nextOrder);
            skillRows.push({ chapter_id: item.chapter_id, title: item.title, description: item.description || null, expected_level: item.expected_level, sort_order: nextOrder, is_active: true });
          }
        });
        if (!knowledgeRows.length && !skillRows.length) throw new Error("All pasted items were duplicates. Nothing was added.");
        if (knowledgeRows.length) u(await e.from("knowledge_items").insert(knowledgeRows));
        if (skillRows.length) u(await e.from("skills").insert(skillRows));
        i.close();
        b(`${knowledgeRows.length} knowledge point${knowledgeRows.length === 1 ? "" : "s"} + ${skillRows.length} skill${skillRows.length === 1 ? "" : "s"} added${skipped ? ` · ${skipped} duplicate${skipped === 1 ? "" : "s"} skipped` : ""}`);
        return void (await w.curriculum(fixedChapterId || ""));
      }
      if ("guidelineAiForm" === a.id) {
        const file = r.get("guideline");
        if (!(file instanceof File) || !file.size) throw new Error("Choose a European guideline PDF");
        if (file.type && file.type !== "application/pdf") throw new Error("The guideline must be a PDF");
        if (file.size > 10 * 1024 * 1024) throw new Error("The guideline PDF must be 10 MB or smaller");
        const submitButton = a.querySelector('button:not([type="button"])');
        if (submitButton) {
          submitButton.disabled = true;
          submitButton.textContent = "Generating…";
        }
        const fileData = await readGuidelineFile(file);
        const { data: generated, error: generationError } = await e.functions.invoke(
          "generate-curriculum-from-guideline",
          {
            body: {
              chapter_id: Number(r.get("chapter_id")),
              chapter_title: s.curriculumChapter?.title || "Cardiology chapter",
              guideline_name: file.name,
              file_data: fileData,
              knowledge_count: Number(r.get("knowledge_count")) || 10,
              skills_count: Number(r.get("skills_count")) || 8,
              instructions: String(r.get("instructions") || "").trim() || null,
            },
          },
        );
        if (generationError) throw generationError;
        if (generated?.error) throw new Error(generated.error);
        renderAiCurriculumDraft(r.get("chapter_id"), generated?.draft || generated);
        return;
      }
      if ("aiCurriculumImportForm" === a.id) {
        const stateDraft = s.aiCurriculumDraft;
        if (!stateDraft || stateDraft.chapterId !== String(r.get("chapter_id")))
          throw new Error("This AI draft is no longer available. Generate it again.");
        const knowledgeIndices = r.getAll("knowledge_indices").map(Number);
        const skillIndices = r.getAll("skill_indices").map(Number);
        if (!knowledgeIndices.length && !skillIndices.length)
          throw new Error("Select at least one knowledge point or skill");
        const currentItems = [...s.curriculumItems.entries()];
        const maxKnowledgeOrder = currentItems
          .filter(([key]) => key.startsWith("knowledge~"))
          .reduce((max, [, item]) => Math.max(max, Number(item.sort_order) || 0), 0);
        const maxSkillOrder = currentItems
          .filter(([key]) => key.startsWith("skill~"))
          .reduce((max, [, item]) => Math.max(max, Number(item.sort_order) || 0), 0);
        const chapterId = Number(r.get("chapter_id"));
        if (knowledgeIndices.length) {
          const rows = knowledgeIndices.map((index, offset) => {
            const item = stateDraft.knowledge[index];
            return {
              chapter_id: chapterId,
              title: String(item.title || "").trim().slice(0, 180),
              description: String(item.description || "").trim().slice(0, 1200) || null,
              sort_order: maxKnowledgeOrder + offset + 1,
              is_active: true,
            };
          }).filter((item) => item.title);
          if (rows.length) u(await e.from("knowledge_items").insert(rows));
        }
        if (skillIndices.length) {
          const rows = skillIndices.map((index, offset) => {
            const item = stateDraft.skills[index];
            return {
              chapter_id: chapterId,
              title: String(item.title || "").trim().slice(0, 180),
              description: String(item.description || "").trim().slice(0, 1200) || null,
              expected_level: Math.max(1, Math.min(5, Number(item.expected_level) || 1)),
              sort_order: maxSkillOrder + offset + 1,
              is_active: true,
            };
          }).filter((item) => item.title);
          if (rows.length) u(await e.from("skills").insert(rows));
        }
        s.aiCurriculumDraft = null;
        i.close();
        b(`${knowledgeIndices.length} knowledge point${knowledgeIndices.length === 1 ? "" : "s"} and ${skillIndices.length} skill${skillIndices.length === 1 ? "" : "s"} imported`);
        return void (await w.curriculum(String(chapterId)));
      }
      if ("curriculumItemForm" === a.id) {
        const s = r.get("kind"),
          t = "skill" === s ? "skills" : "knowledge_items",
          a = {
            chapter_id: +r.get("chapter_id"),
            title: r.get("title").trim(),
            description: r.get("description").trim() || null,
            sort_order: +r.get("sort_order") || 0,
            is_active: "on" === r.get("is_active"),
          };
        "skill" === s && (a.expected_level = +r.get("expected_level"));
        const i = r.get("item_id");
        u(
          i ? await e.from(t).update(a).eq("id", i) : await e.from(t).insert(a),
        );
      }
      if ("ownerMessageCleanupForm" === a.id) {
        const categories = r.getAll("categories");
        if (!categories.length) throw new Error("Choose at least one message category");
        const labels = [...a.querySelectorAll('input[name="categories"]:checked')].map((box) => box.closest("label")?.querySelector("b")?.textContent || box.value);
        if (!confirm(`Delete all messages in: ${labels.join(", ")}? Resident My logbook records will remain unchanged.`)) return;
        const count = u(await e.rpc("owner_cleanup_message_categories", { p_categories: categories, p_delete_all: false }));
        b(`${count} message${count === 1 ? "" : "s"} deleted. Resident logbooks were not changed.`);
        await q();
        return void (await ownerMessageCleanupPage());
      }
      if ("ownerAuditResetForm" === a.id) {
        const mode = String(r.get("mode") || "selected");
        const confirmation = String(r.get("confirmation") || "").trim().toUpperCase();
        if (mode === "all") {
          if (confirmation !== "RESET LOGBOOKS") throw new Error("Type RESET LOGBOOKS exactly to confirm");
          const resetCount = u(await e.rpc("owner_bulk_reset_logbooks", { p_resident_ids: [], p_reset_all: true }));
          i.close();
          await q();
          b(`${resetCount || 0} resident logbook${Number(resetCount) === 1 ? "" : "s"} reset · intervention audit cleared`);
          return void (await ownerInterventionAuditPage());
        }
        const ids = r.getAll("resident_ids").map(String).filter(Boolean);
        if (!ids.length) throw new Error("Choose at least one resident");
        if (confirmation !== "RESET SELECTED") throw new Error("Type RESET SELECTED exactly to confirm");
        const resetCount = u(await e.rpc("owner_bulk_reset_logbooks", { p_resident_ids: ids, p_reset_all: false }));
        i.close();
        await q();
        b(`${resetCount || 0} selected resident logbook${Number(resetCount) === 1 ? "" : "s"} reset`);
        return void (await ownerInterventionAuditPage());
      }
      if ("ownerTestResetForm" === a.id) {
        const scope = String(r.get("scope") || "");
        const confirmation = String(r.get("confirmation") || "");
        const result = u(await e.rpc("owner_reset_test_period_v1058", {
          p_scope: scope,
          p_confirmation: confirmation,
        })) || {};
        i.close();
        await q();
        const removedReviews = Number(result.reviews_deleted || 0);
        const removedLearning = Number(result.learning_rows_deleted || 0);
        b(`Reset complete · ${removedReviews} review${removedReviews === 1 ? "" : "s"} · ${removedLearning} learning-progress row${removedLearning === 1 ? "" : "s"}`);
        return void (await ownerTestResetPage());
      }
      if ("messageForm" === a.id) {
        if (s.p.role === "owner") {
          const scope = r.get("recipient_scope");
          const ids = r.getAll("recipient_ids");
          if (["selected_people", "selected_assessors", "selected_residents"].includes(scope) && !ids.length)
            throw new Error("Choose at least one recipient");
          const result = u(await e.rpc("owner_send_group_message", {
            p_scope: scope,
            p_recipient_ids: ids.length ? ids : null,
            p_residency_year: r.get("residency_year") ? Number(r.get("residency_year")) : null,
            p_subject: r.get("subject") || null,
            p_body: r.get("body"),
          }));
          b(`Message sent to ${result} recipient${result === 1 ? "" : "s"}`);
        } else {
          u(await e.rpc("send_private_message", {
            p_receiver_id: r.get("receiver_id"),
            p_subject: r.get("subject") || null,
            p_body: r.get("body"),
          }));
          b("Message sent");
        }
        i.close();
        return void (await inboxPage());
      }
      if ("logbookForm" === a.id) {
        u(
          await e.rpc("submit_logbook_entry_v2", {
            p_activity_category: r.get("activity_category"),
            p_activity_date: r.get("activity_date"),
            p_conference_participation:
              r.get("conference_participation") || null,
            p_conference_name: r.get("conference_name") || null,
            p_procedure_name: r.get("procedure_name") || null,
            p_participation_mode: r.get("participation_mode") || null,
            p_hospital: r.get("hospital") || null,
            p_senior_resident_id: r.get("senior_resident_id") || null,
            p_assessor_id: r.get("assessor_id"),
            p_description: r.get("description") || null,
          }),
        );
      }
      if ("logbookReviewForm" === a.id) {
        const decision = r.get("decision");
        const enteredNote = String(r.get("note") || "").trim();
        const note = enteredNote || (decision === "approved" ? "Approved" : "");
        if (decision === "rejected" && note.length < 2)
          throw new Error("A note is required when rejecting an entry");
        u(
          await e.rpc("review_logbook_entry_v1051", {
            p_entry_id: r.get("entry_id"),
            p_decision: decision,
            p_note: note,
          }),
        );
        await q();
      }
      if ("logbookReconsiderationResolveForm" === a.id) {
        const decisionNote = String(r.get("note") || "").trim();
        if (!decisionNote) throw new Error("A decision note is required for both approval and rejection");
        const finalStatus = u(await e.rpc("resolve_logbook_reconsideration_v1044", {
          p_reconsideration_id: r.get("reconsideration_id"),
          p_decision: r.get("decision"),
          p_note: decisionNote,
        }));
        i.close();
        await q();
        b(`${r.get("decision") === "approved" ? "Reconsideration approved" : "Reconsideration rejected"} · final logbook status: ${finalStatus || "updated"}`);
        return void (await logbookRequestsPage());
      }
      if ("logbookReclaimForm" === a.id) {
        const reviewerId = String(r.get("reviewer_id") || "");
        if (!reviewerId) throw new Error("The rejecting reviewer could not be identified. Refresh Logbook requests and try again.");
        u(await e.rpc("submit_logbook_reconsideration_v1042", {
          p_entry_id: r.get("entry_id"),
          p_reviewer_id: reviewerId,
          p_justification: r.get("justification"),
        }));
        i.close();
        b("Reconsideration is now waiting for the rejecting reviewer");
        return void (await logbookRequestsPage());
      }
      if ("scheduleForm" === a.id) {
        const t = new Date(r.get("starts_at")),
          a = new Date(r.get("ends_at"));
        if (a <= t) throw new Error("Closing time must be after opening time");
        const i = {
            title: r.get("title").trim(),
            residency_year: +r.get("residency_year"),
            chapter_id: null,
            assessor_id: r.get("assessor_id") || null,
            assessment_type: r.get("assessment_type"),
            starts_at: t.toISOString(),
            ends_at: a.toISOString(),
            location: r.get("location").trim() || null,
            instructions: r.get("instructions").trim() || null,
            progression_enabled: "on" === r.get("progression_enabled"),
            is_active: "on" === r.get("is_active"),
          },
          n = r.get("schedule_id"),
          saved = u(
            n
              ? await e
                  .from("assessment_schedules")
                  .update(i)
                  .eq("id", n)
                  .select("id")
                  .single()
              : await e
                  .from("assessment_schedules")
                  .insert({ ...i, created_by: s.p.id })
                  .select("id")
                  .single(),
          ),
          scheduleId = saved.id,
          chapterIds = r.getAll("chapter_ids").map(Number);
        u(
          await e
            .from("assessment_schedule_chapters")
            .delete()
            .eq("schedule_id", scheduleId),
        );
        if (chapterIds.length)
          u(
            await e
              .from("assessment_schedule_chapters")
              .insert(
                chapterIds.map((chapterId) => ({
                  schedule_id: scheduleId,
                  chapter_id: chapterId,
                })),
              ),
          );
      }
      if ("profileForm" === a.id) {
        const t = {
            display_name: r.get("display_name"),
            whatsapp: r.get("whatsapp") || null,
          },
          a = r.get("avatar");
        if (a?.size) {
          if (a.size > 5242880)
            throw new Error("Profile photo must be 5 MB or smaller");
          const i = {
            "image/jpeg": "jpg",
            "image/png": "png",
            "image/webp": "webp",
          }[a.type];
          if (!i) throw new Error("Choose a JPG, PNG or WebP image");
          const n = `${s.p.id}/avatar-${Date.now()}.${i}`,
            o = await e.storage
              .from("avatars")
              .upload(n, a, { contentType: a.type, cacheControl: "3600" });
          if (o.error) throw o.error;
          const { data: d } = e.storage.from("avatars").getPublicUrl(n);
          t.avatar_url = d.publicUrl;
        }
        const i = u(
          await e.from("profiles").update(t).eq("id", s.p.id).select().single(),
        );
        ((s.p = i), f());
      }
      if ("passwordForm" === a.id) {
        const s = r.get("password");
        if (s !== r.get("confirm")) throw new Error("Passwords do not match");
        const { error: t } = await e.auth.updateUser({ password: s });
        if (t) throw t;
        return (a.reset(), void b("Password updated successfully"));
      }
      if ("assessmentForm" === a.id) {
        const s = Object.fromEntries(r);
        u(
          await e.rpc("submit_scheduled_assessment", {
            p_schedule_id: +s.schedule_id,
            p_resident_id: s.resident_id,
            p_knowledge_score: +s.knowledge_score,
            p_skills_score: +s.skills_score,
            p_attitude_score: +s.attitude_score,
            p_knowledge_reason_ids: r.getAll("knowledge_reasons").map(Number),
            p_skills_reason_ids: r.getAll("skills_reasons").map(Number),
            p_attitude_reason_ids: r.getAll("attitude_reasons").map(Number),
            p_knowledge_justification: s.knowledge_justification || null,
            p_skills_justification: s.skills_justification || null,
            p_attitude_justification: s.attitude_justification || null,
            p_assessor_notes: null,
          }),
        );
        const passed = Number(s.knowledge_score) >= 6 && Number(s.skills_score) >= 7 && Number(s.attitude_score) >= 8;
        const progression = u(await e.rpc("apply_end_of_year_progression", {
          p_schedule_id: +s.schedule_id,
          p_resident_id: s.resident_id,
          p_passed: passed,
          p_knowledge_score: +s.knowledge_score,
          p_skills_score: +s.skills_score,
          p_attitude_score: +s.attitude_score,
          p_knowledge_justification: s.knowledge_justification || null,
          p_skills_justification: s.skills_justification || null,
          p_attitude_justification: s.attitude_justification || null,
        }));
        if (progression?.action === "upgraded") b(`Assessment saved · resident upgraded to Year ${progression.new_year}`);
        else if (progression?.action === "reassessment") b(`Assessment saved · reassessment due ${d(progression.reassessment_due)}`);
      }
      (i.open && i.close(), b("Saved successfully"), $());
    } catch (e) {
      alert(e.message);
    }
  }),
  (t("#menu").onclick = () => {
    (t("aside").classList.add("open"), t("#backdrop").classList.add("show"));
  }),
  (t("#backdrop").onclick = () => {
    (t("aside").classList.remove("open"),
      t("#backdrop").classList.remove("show"));
  }),
  (t("#profileChip").onclick = t("#userCard").onclick = () => g("profile")),
  t("#password")?.addEventListener("click", () => g("profile")),
  (t("#logout").onclick = async () => {
    (await e.auth.signOut(), location.replace("index.html"));
  }),
  addEventListener("hashchange", $));
const {
  data: { session: I },
} = await e.auth.getSession();
if (I) {
  s.session = I;
  const { data: t } = await e
    .from("profiles")
    .select("*")
    .eq("id", I.user.id)
    .single();
  t?.is_active
    ? ((s.p = t), f(), $())
    : (await e.auth.signOut(), location.replace("index.html"));
} else location.replace("index.html");



/* v1.0.53 — password visibility eye for profile/account password fields */
const passwordEyeSvg = (hidden = true) => hidden
  ? `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.4 12s3.5-6 9.6-6 9.6 6 9.6 6-3.5 6-9.6 6-9.6-6-9.6-6Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="2.8" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>`
  : `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 6.2A10.8 10.8 0 0 1 12 6c6.1 0 9.6 6 9.6 6a16.1 16.1 0 0 1-3.1 3.7M6.1 7.2C3.7 9.1 2.4 12 2.4 12s3.5 6 9.6 6a10.5 10.5 0 0 0 3.5-.6M9.9 9.9A3 3 0 0 0 14.1 14.1" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

function installPasswordVisibility(root = document) {
  root.querySelectorAll?.('input[type="password"]:not([data-password-eye-ready])').forEach((input) => {
    input.dataset.passwordEyeReady = "true";
    const wrapper = document.createElement("span");
    wrapper.className = "password-input-wrap";
    input.parentNode.insertBefore(wrapper, input);
    wrapper.appendChild(input);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "password-eye-button";
    button.setAttribute("aria-label", "Show password");
    button.setAttribute("title", "Show password");
    button.innerHTML = passwordEyeSvg(true);
    wrapper.appendChild(button);
  });
}

document.addEventListener("click", (event) => {
  const button = event.target.closest(".password-eye-button");
  if (!button) return;
  event.preventDefault();
  event.stopPropagation();
  const input = button.closest(".password-input-wrap")?.querySelector("input");
  if (!input) return;
  const willShow = input.type === "password";
  input.type = willShow ? "text" : "password";
  const label = willShow ? "Hide password" : "Show password";
  button.setAttribute("aria-label", label);
  button.setAttribute("title", label);
  button.innerHTML = passwordEyeSvg(!willShow);
  input.focus({ preventScroll: true });
});

installPasswordVisibility();
new MutationObserver((changes) => changes.forEach((change) => change.addedNodes.forEach((node) => {
  if (node.nodeType === 1) installPasswordVisibility(node);
}))).observe(document.body, { childList: true, subtree: true });

const defaultDateInputs = (root = document) => {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  const today = now.toISOString().slice(0, 10);
  root.querySelectorAll?.('input[type="date"]:not([value])').forEach((input) => {
    if (!input.value) input.value = today;
  });
};
defaultDateInputs();
new MutationObserver((changes) => changes.forEach((change) => change.addedNodes.forEach((node) => {
  if (node.nodeType === 1) defaultDateInputs(node);
}))).observe(document.body, { childList: true, subtree: true });

// v1.0.53 — read-on-decision, review tables, logbook-history table
