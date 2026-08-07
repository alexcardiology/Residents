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
  d = (e) =>
    e
      ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(
          new Date(e),
        )
      : "—",
  l = (e) =>
    e
      ? new Intl.DateTimeFormat("en-GB", {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(new Date(e))
      : "—",
  c = (e) => {
    if (!e) return "";
    const s = new Date(e);
    return (
      s.setMinutes(s.getMinutes() - s.getTimezoneOffset()),
      s.toISOString().slice(0, 16)
    );
  },
  u = ({ data: e, error: s }) => {
    if (s) throw s;
    return e;
  },
  p = {
    resident: [
      ["dashboard", "Dashboard"],
      ["chapters", "My chapters"],
      ["assessments", "My assessments"],
      ["logbook", "My logbook"],
      ["inbox", "Inbox"],
      ["profile", "My profile"],
    ],
    observer: [
      ["dashboard", "Write a review"],
      ["reviews", "My previous reviews"],
      ["logbook", "Logbook approvals"],
      ["inbox", "Inbox"],
      ["profile", "My profile"],
    ],
    assessor: [
      ["dashboard", "Dashboard"],
      ["residents", "Assigned residents"],
      ["write-review", "Write a review"],
      ["assessments", "Assessments"],
      ["comments", "Observer comments"],
      ["logbook", "Resident logbooks"],
      ["inbox", "Inbox"],
      ["profile", "My profile"],
    ],
    owner: [
      ["dashboard", "Overview"],
      ["users", "Accounts"],
      ["curriculum", "Curriculum"],
      ["schedule", "Assessment schedule"],
      ["progress", "Resident progress"],
      ["assessments", "Assessments"],
      ["comments", "Observer reviews"],
      ["assignments", "Assessor assignments"],
      ["logbook", "Resident logbooks"],
      ["inbox", "Inbox"],
      ["profile", "My profile"],
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
          `<button data-go="${e}"><span>${o(s)}</span>${e === "inbox" ? '<span class="nav-badge" data-inbox-badge hidden>0</span>' : ""}</button>`,
      )
      .join("")),
    (t("#loading").hidden = !0),
    (t("#shell").hidden = !1),
    q());
}
async function q() {
  const { data, error } = await e.rpc("get_private_messages", {
    p_box: "inbox",
  });
  if (error) return;
  const count = (data || []).filter((message) => !message.is_read).length;
  document.querySelectorAll("[data-inbox-badge]").forEach((badge) => {
    badge.textContent = count;
    badge.hidden = count === 0;
  });
}
async function $() {
  const [e = "dashboard", s = ""] = location.hash.slice(1).split(":");
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
    a.innerHTML =
      h(
        "Your cardiology curriculum",
        "Access is cumulative: current and preceding years remain open.",
      ) +
      `<div class="chapters">${(i || []).map((e) => ` <article class="card chapter" data-chapter="${e.id}"> <span class="tag">Year ${e.year_from}${e.year_to > e.year_from ? `–${e.year_to}` : ""}</span> <h3>${o(e.title)}</h3> <p>${o(e.description)}</p> </article>`).join("")}</div>`;
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
      [d, l, c, p, m, v] = r.map(u);
    t("#title").textContent = d.title;
    const _ = new Map(p?.map((e) => [e.knowledge_item_id, e.status])),
      b = new Map(m?.map((e) => [e.skill_id, e.level]));
    a.innerHTML =
      h(
        d.title,
        d.description,
        '<button class="btn secondary" data-go="chapters">All chapters</button>',
      ) +
      ` <section class="card"> <h3>Five levels of independence</h3> <div class="scale"> ${["1 Observer", "2 Direct supervision", "3 Limited supervision", "4 Independent", "5 Expert / supervisor"].map((e) => `<div>${e}</div>`).join("")} </div> </section> <div class="grid g2 top-gap"> <section class="card"> <h3>Knowledge</h3> <div class="items">${l.map((e) => ` <label class="item"> <input class="auto-width" type="checkbox" data-k="${e.id}" ${"completed" === _.get(e.id) ? "checked" : ""}> <b>${o(e.title)}</b> <p>${o(e.description)}</p> </label>`).join("")}</div> </section> <section class="card"> <h3>Skills and logbook</h3> <div class="items">${c.map((e) => ` <article class="item"> <h4>${o(e.title)} <span class="tag">${v?.filter((s) => s.skill_id === e.id).length || 0} logs</span></h4> <p>${o(e.description)}</p> <div class="inline-actions"> <select data-level="${e.id}"> <option value="">Level</option> ${n.map((s) => `<option ${b.get(e.id) === s ? "selected" : ""}>${s}</option>`).join("")} </select> <button class="btn" data-log="${e.id}" data-name="${o(e.title)}">Add performance</button> </div> </article>`).join("")}</div> </section> </div>`;
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
    if ("observer" !== s.p.role) return g("dashboard");
    t("#title").textContent = "My reviews";
    const { data: i } = await e.rpc("get_my_observer_reviews");
    a.innerHTML =
      h(
        "Comments written by you",
        "No observer can see another observer’s private history.",
      ) + q(i || [], !0);
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
        e.from("observer_reviews").select("*").eq("resident_id", i),
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
      ` <div class="grid g3 top-gap"> ${_("Knowledge complete", c.data?.length || 0, "topics")} ${_("Skill logs", d.data?.length || 0, "performances")} ${_("Previous assessments", u.data?.length || 0, "records")} </div> <div class="top-gap">${q(n.data || [])}</div> <div class="grid top-gap">${u.data?.map(A).join("") || v("No previous assessments.")}</div>`;
  },
  comments: async function () {
    if (!["owner", "assessor"].includes(s.p.role)) return g("dashboard");
    const { data: t } = await e
      .from("observer_reviews")
      .select("*")
      .order("observed_on", { ascending: !1 });
    a.innerHTML =
      h(
        "Observer comments",
        "Signed clinical observations in your permitted scope.",
      ) + q(t || []);
  },
  users: async function () {
    if ("owner" !== s.p.role) return g("dashboard");
    const [t, i] = await Promise.all([
        e.from("profiles").select("*").order("created_at", { ascending: !1 }),
        e
          .from("assessor_year_assignments")
          .select("assessor_id,residency_year")
          .eq("is_active", !0)
          .order("residency_year"),
      ]),
      r = M(i.data || []);
    a.innerHTML =
      h(
        "Controlled accounts",
        "Only the owner creates or suspends access.",
        '<button class="btn" data-create>Create account</button>',
      ) +
      ` <section class="card table-card"> <div class="table-scroll"> <table class="table"> <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Year access</th><th>Access</th></tr></thead> <tbody>${t.data
        .map((e) => {
          return ` <tr> <td><b>${o(e.display_name)}</b><br><small>@${o(e.username)}</small></td> <td>${o(e.email)}</td> <td>${m(e.role)}</td> <td>${"resident" === e.role ? `<span class="year-chip">Year ${e.residency_year}</span>` : "assessor" === e.role ? ((s = r.get(e.id) || []), s.length ? `<div class="year-chips">${s.map((e) => `<span class="year-chip">Year ${e}</span>`).join("")}</div>` : '<span class="muted">Not assigned</span>') : "—"}</td> <td>${"owner" === e.role ? "Owner" : `<button class="btn ${e.is_active ? "danger" : "success"}" data-status="${e.id}" data-active="${!e.is_active}">${e.is_active ? "Suspend" : "Activate"}</button>`}</td> </tr>`;
          var s;
        })
        .join("")}</tbody> </table> </div> </section>`;
  },
  progress: async function () {
    if ("owner" !== s.p.role) return g("dashboard");
    const { data: t } = await e.rpc("owner_resident_progress");
    a.innerHTML =
      h(
        "Resident progress",
        "Evidence, reassessment restrictions and eligible upgrades.",
      ) +
      ` <section class="card table-card"> <div class="table-scroll"> <table class="table"> <thead><tr><th>Resident</th><th>Year</th><th>Knowledge</th><th>Logs</th><th>Status</th><th></th></tr></thead> <tbody>${t.map((e) => ` <tr> <td>${o(e.display_name)}</td> <td>${e.residency_year}</td> <td>${e.knowledge_completed}</td> <td>${e.skill_log_count}</td> <td><span class="tag ${"eligible_for_upgrade" === e.progression_status ? "success" : "reassessment_required" === e.progression_status ? "warning" : ""}">${o(e.progression_status.replaceAll("_", " "))}</span></td> <td>${"eligible_for_upgrade" === e.progression_status && e.residency_year < 5 ? `<button class="btn" data-upgrade="${e.id}" data-name="${o(e.display_name)}">Confirm upgrade</button>` : ""}</td> </tr>`).join("")}</tbody> </table> </div> </section>`;
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
        ) +
        `<div class="chapters">${s
          .map((e) => {
            const s = t.filter(
                (s) => s.chapter_id === e.id && s.is_active,
              ).length,
              a = i.filter((s) => s.chapter_id === e.id && s.is_active).length;
            return ` <article class="card chapter"> <span class="tag">Year ${e.year_from}${e.year_to > e.year_from ? `–${e.year_to}` : ""}</span> <h3>${o(e.title)}</h3> <p>${o(e.description || "")}</p> <p><b>${s}</b> knowledge points · <b>${a}</b> skills</p> <button class="btn" data-curriculum-chapter="${e.id}">Manage chapter</button> </article>`;
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
        .order("sort_order")
        .order("id"),
      e
        .from("skills")
        .select("*")
        .eq("chapter_id", i)
        .order("sort_order")
        .order("id"),
    ]).then((e) => e.map(u));
    a.innerHTML =
      h(
        r.title,
        "Add, edit, reorder or hide curriculum items without removing resident history.",
        '<button class="btn secondary" data-go="curriculum">All chapters</button>',
      ) +
      ` <div class="grid g2 curriculum-columns"> <section class="card"> <div class="section-head"> <div><h3>Knowledge points</h3><p>${n.length} items</p></div> <button class="btn" data-curriculum-add="knowledge" data-chapter-id="${r.id}">Add knowledge</button> </div> <div class="items">${n.map((e) => L("knowledge", e)).join("") || v("No knowledge points yet.")}</div> </section> <section class="card"> <div class="section-head"> <div><h3>Skills</h3><p>${d.length} items</p></div> <button class="btn" data-curriculum-add="skill" data-chapter-id="${r.id}">Add skill</button> </div> <div class="items">${d.map((e) => L("skill", e)).join("") || v("No skills yet.")}</div> </section> </div>`;
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
  "write-review": reviewPage,
  password: x,
};

async function reviewPage() {
  if (!["observer", "assessor"].includes(s.p.role)) return g("dashboard");
  t("#title").textContent = "Write a review";
  a.innerHTML =
    h(
      "Record a clinical observation",
      "Choose any resident, then write a signed knowledge, skill or attitude comment.",
    ) +
    `
    <section class="card"><div class="form-grid">
      <label>Search resident<input id="findResident" placeholder="Name or username"></label>
      <label>Residency year<select id="findYear"><option value="">All years</option>${n.map((year) => `<option>${year}</option>`).join("")}</select></label>
    </div><div id="results" class="top-gap">${v("Loading residents…")}</div></section>`;
  await R();
}

async function inboxPage() {
  t("#title").textContent = "Inbox";
  const [inboxResult, sentResult] = await Promise.all([
    e.rpc("get_private_messages", { p_box: "inbox" }),
    e.rpc("get_private_messages", { p_box: "sent" }),
  ]);
  const inbox = u(inboxResult) || [];
  const sent = u(sentResult) || [];
  const rows = (items, box) =>
    items.length
      ? items
          .map(
            (message) => `
    <article class="message-row ${box === "inbox" && !message.is_read ? "unread" : ""}">
      <button class="message-open" data-message-id="${message.id}" data-message-box="${box}">
        <span class="message-person">${o(box === "inbox" ? message.sender_name : message.receiver_name)}</span>
        <strong>${o(message.subject || "No subject")}</strong><small>${l(message.created_at)}</small>
      </button>
      ${box === "inbox" && message.logbook_entry_id && !message.logbook_action_taken ? `<div class="message-actions"><button class="btn small" data-inbox-logbook-review="${message.logbook_entry_id}" data-approval-message-id="${message.id}" data-logbook-title="${o(message.logbook_title || "Logbook activity")}">Approve / Reject</button></div>` : ""}
    </article>`,
          )
          .join("")
      : '<div class="mail-empty">No messages here.</div>';
  window.residentMessages = new Map([
    ...inbox.map((message) => [String(message.id), message]),
    ...sent.map((message) => [`sent-${message.id}`, message]),
  ]);
  a.innerHTML =
    h(
      "Private messages",
      "Send and receive secure messages within the training program.",
      '<button class="btn" data-compose-message>New message</button>',
    ) +
    `
    <div class="mail-grid">
      <section class="card mail-panel"><div class="mail-heading"><h3>Inbox</h3><span class="tag">${inbox.filter((item) => !item.is_read).length} unread</span></div><div class="message-list">${rows(inbox, "inbox")}</div></section>
      <section class="card mail-panel"><div class="mail-heading"><h3>Sent</h3><span class="tag">${sent.length}</span></div><div class="message-list">${rows(sent, "sent")}</div></section>
    </div>`;
}

async function openComposer(replyTo = null) {
  const { data: contacts } = await e.rpc("message_contacts", {
    search_text: null,
  });
  y(`<form id="messageForm" class="modal">
    <div class="modal-head"><div><span class="eyebrow">Private inbox</span><h2>${replyTo ? "Reply" : "New message"}</h2></div><button type="button" data-close>×</button></div>
    <div class="form-grid">
      <label class="full">To<select name="receiver_id" required><option value="">Choose a person</option>${(contacts || []).map((contact) => `<option value="${contact.id}" ${replyTo === contact.id ? "selected" : ""}>${o(contact.display_name)} · ${o(m(contact.role))}</option>`).join("")}</select></label>
      <label class="full">Subject<input name="subject" maxlength="150"></label>
      <label class="full">Message<textarea name="body" maxlength="5000" required></textarea></label>
    </div><div class="actions"><button type="button" class="btn secondary" data-close>Cancel</button><button>Send message</button></div>
  </form>`);
}
function openLogbookDecision(entryId, title, messageId = "") {
  y(` <form id="logbookReviewForm" class="modal"> <div class="modal-head"><div><span class="eyebrow">Supervisor decision</span><h2>${o(title)}</h2></div><button type="button" data-close>×</button></div><label>Decision<select name="decision" id="logbookDecision" required><option value="approved">Approve</option><option value="rejected">Reject</option></select></label><label>Supervisor note <small id="logbookNoteHint">Optional for approval</small><textarea name="note" minlength="2"></textarea></label><input type="hidden" name="entry_id" value="${o(entryId)}"><input type="hidden" name="message_id" value="${o(messageId)}"><div class="actions"><button type="button" class="btn secondary" data-close>Cancel</button><button>Submit decision</button></div></form>`);
}
async function k() {
  const i = s.p;
  if (
    ((t("#title").textContent = "Dashboard"),
    (t("#crumb").textContent = m(i.role)),
    "resident" === i.role)
  ) {
    const [s, t, r, n, scheduleResult] = await Promise.all([
        e
          .from("chapters")
          .select("*")
          .lte("year_from", i.residency_year)
          .eq("is_active", !0),
        e
          .from("skill_logs")
          .select("*", { head: !0, count: "exact" })
          .eq("resident_id", i.id),
        e
          .from("knowledge_progress")
          .select("*", { head: !0, count: "exact" })
          .eq("resident_id", i.id)
          .eq("status", "completed"),
        e
          .from("assessments")
          .select("*")
          .eq("resident_id", i.id)
          .order("assessment_date", { ascending: !1 })
          .limit(1),
        e
          .from("assessment_schedules")
          .select("*,assessment_schedule_chapters(chapter_id,chapters(title))")
          .eq("is_active", !0)
          .eq("residency_year", i.residency_year)
          .gte("ends_at", new Date().toISOString())
          .order("starts_at")
          .limit(1),
      ]),
      latest = n.data?.[0],
      upcoming = scheduleResult.data?.[0],
      scope =
        upcoming?.assessment_schedule_chapters
          ?.map((item) => item.chapters?.title)
          .filter(Boolean) || [];
    return void (a.innerHTML =
      h(
        `Welcome, ${i.display_name || i.username}`,
        "Track the evidence behind your clinical development.",
      ) +
      ` <div class="grid g4"> ${_("Available chapters", s.data?.length || 0, "Cumulative access")} ${_("Skills recorded", t.count || 0, "Supervised performances")} ${_("Knowledge complete", r.count || 0, "Self-recorded topics")} ${_("Latest result", latest ? `${latest.total_score}/30` : "—", latest ? (latest.overall_pass ? "Passed" : "Reassessment required") : "Not assessed")} </div>` +
      (upcoming
        ? `<section class="card upcoming-assessment"><div><span class="eyebrow">Upcoming assessment</span><h2>${o(upcoming.title)}</h2></div><div class="assessment-time"><b>${l(upcoming.starts_at)}</b><small>Closes ${l(upcoming.ends_at)}</small></div><div class="assessment-scope"><b>Chapters</b><p>${o(scope.length ? scope.join(" · ") : "Whole-year assessment")}</p></div>${upcoming.location ? `<div class="assessment-scope"><b>Location / method</b><p>${o(upcoming.location)}</p></div>` : ""}</section>`
        : '<section class="card upcoming-assessment quiet"><span class="eyebrow">Upcoming assessment</span><h3>No assessment is currently scheduled.</h3></section>') +
      ("reassessment_required" === i.progression_status
        ? `<div class="card warning notice-card"><b>Reassessment due ${d(i.reassessment_due)}</b><p>You remain at your current year until you pass.</p></div>`
        : "eligible_for_upgrade" === i.progression_status
          ? '<div class="card success notice-card"><b>Congratulations—you passed.</b><p>The owner can now confirm your upgrade.</p></div>'
          : ""));
  }
  if ("observer" === i.role)
    return void (a.innerHTML =
      h(
        "Record a clinical observation",
        "Find a resident, then write a signed knowledge, skill or attitude comment.",
      ) +
      ` <section class="card"> <div class="form-grid"> <label>Search resident<input id="findResident" placeholder="Name or username"></label> <label>Residency year <select id="findYear"> <option value="">All years</option> ${n.map((e) => `<option>${e}</option>`).join("")} </select> </label> </div> <div id="results" class="top-gap">${v("Start typing to find a resident.")}</div> </section>`);
  if ("assessor" === i.role) {
    const assigned = (await S()).data || [],
      residentIds = assigned.map((item) => item.resident_id),
      now = new Date().toISOString(),
      [
        schedulesResult,
        knowledgeResult,
        skillsResult,
        assessmentsResult,
        commentsResult,
      ] = await Promise.all([
        e.rpc("my_assessor_schedule"),
        residentIds.length
          ? e
              .from("knowledge_progress")
              .select("resident_id,status")
              .in("resident_id", residentIds)
          : Promise.resolve({ data: [] }),
        residentIds.length
          ? e
              .from("skill_logs")
              .select("resident_id")
              .in("resident_id", residentIds)
          : Promise.resolve({ data: [] }),
        residentIds.length
          ? e
              .from("assessments")
              .select("resident_id,total_score,overall_pass,assessment_date")
              .in("resident_id", residentIds)
              .order("assessment_date", { ascending: !1 })
          : Promise.resolve({ data: [] }),
        residentIds.length
          ? e
              .from("observer_reviews")
              .select("*")
              .in("resident_id", residentIds)
              .order("observed_on", { ascending: !1 })
              .limit(5)
          : Promise.resolve({ data: [] }),
      ]),
      nextAssessment = (schedulesResult.data || [])
        .filter((item) => item.schedule_status !== "finished")
        .sort((x, y) => new Date(x.starts_at) - new Date(y.starts_at))[0],
      knowledgeCounts = (knowledgeResult.data || []).reduce((map, item) => {
        if (item.status === "completed")
          map.set(item.resident_id, (map.get(item.resident_id) || 0) + 1);
        return map;
      }, new Map()),
      skillCounts = (skillsResult.data || []).reduce((map, item) => {
        map.set(item.resident_id, (map.get(item.resident_id) || 0) + 1);
        return map;
      }, new Map()),
      latestAssessments = (assessmentsResult.data || []).reduce((map, item) => {
        if (!map.has(item.resident_id)) map.set(item.resident_id, item);
        return map;
      }, new Map()),
      scope =
        (
          nextAssessment?.chapters ||
          nextAssessment?.assessment_schedule_chapters
        )
          ?.map((item) => item.title || item.chapters?.title)
          .filter(Boolean) || [],
      progressRows = assigned.length
        ? assigned
            .map((resident) => {
              const latest = latestAssessments.get(resident.resident_id),
                status = latest
                  ? latest.overall_pass
                    ? '<span class="tag success">Passed</span>'
                    : '<span class="tag warning">Reassessment</span>'
                  : '<span class="tag">Not assessed</span>';
              return `<tr>
                <td><b>${o(resident.resident_name || resident.username)}</b><br><small>Year ${resident.residency_year}</small></td>
                <td>${knowledgeCounts.get(resident.resident_id) || 0}</td>
                <td>${skillCounts.get(resident.resident_id) || 0}</td>
                <td>${latest ? `${latest.total_score}/30` : "—"}<br>${status}</td>
                <td><button class="btn small" data-candidate="${resident.resident_id}~">Open</button></td>
              </tr>`;
            })
            .join("")
        : '<tr><td colspan="5">No assigned residents yet.</td></tr>',
      assignedPreview = assigned.length
        ? assigned
            .slice(0, 6)
            .map(
              (
                resident,
              ) => `<button class="assessor-resident-row" data-candidate="${resident.resident_id}~">
                <span><b>${o(resident.resident_name || resident.username)}</b><small>@${o(resident.username || "resident")}</small></span>
                <span class="year-chip">Year ${resident.residency_year}</span>
              </button>`,
            )
            .join("")
        : '<div class="panel-empty">No residents are assigned yet.</div>',
      recentComments = commentsResult.data || [];

    return void (a.innerHTML =
      h(
        `Welcome, ${i.display_name || i.username}`,
        "Your assessment responsibilities and assigned residents in one place.",
      ) +
      `<div class="assessor-dashboard">
        <section class="card assessor-panel assessor-next">
          <div class="panel-heading"><div><span class="panel-number">1</span><span class="eyebrow">Next assessment</span></div><button class="text-link" data-go="assessments">View schedule</button></div>
          ${
            nextAssessment
              ? `<div class="next-assessment-body"><div><h2>${o(nextAssessment.title)}</h2><p>Year ${nextAssessment.residency_year} · ${o(nextAssessment.assessment_type)}</p></div><div class="next-time"><b>${l(nextAssessment.starts_at)}</b><small>Closes ${l(nextAssessment.ends_at)}</small></div><div class="scope-tags">${(scope.length ? scope : ["Whole-year assessment"]).map((item) => `<span>${o(item)}</span>`).join("")}</div></div>`
              : '<div class="panel-empty">No upcoming assessment is assigned to you.</div>'
          }
        </section>

        <section class="card assessor-panel assessor-assigned">
          <div class="panel-heading"><div><span class="panel-number">2</span><h3>Assigned residents</h3></div><button class="text-link" data-go="residents">View all (${assigned.length})</button></div>
          <div class="assessor-resident-list">${assignedPreview}</div>
        </section>

        <section class="card assessor-panel assessor-progress">
          <div class="panel-heading"><div><span class="panel-number">3</span><h3>Monitor progress</h3></div><span class="tag">${assigned.length} residents</span></div>
          <div class="table-scroll"><table class="table compact-table"><thead><tr><th>Resident</th><th>Knowledge</th><th>Skill logs</th><th>Latest result</th><th></th></tr></thead><tbody>${progressRows}</tbody></table></div>
        </section>

        <section class="card assessor-panel assessor-comments">
          <div class="panel-heading"><div><span class="panel-number">4</span><h3>Observer comments</h3></div><button class="text-link" data-go="comments">View all</button></div>
          ${
            recentComments.length
              ? `<div class="comment-preview-list">${recentComments
                  .map(
                    (comment) =>
                      `<article><div><span class="tag">${o(comment.category)}</span><small>${d(comment.observed_on)}</small></div><b>${o(comment.resident_name || "Resident")}</b><p>${o(comment.comment)}</p><small>By ${o(comment.observer_signature)}</small></article>`,
                  )
                  .join("")}</div>`
              : '<div class="panel-empty">No observer comments for your assigned residents.</div>'
          }
        </section>

        <section class="card assessor-panel assessor-review">
          <div class="panel-heading"><div><span class="panel-number">5</span><span class="eyebrow">Submit a review</span></div></div>
          <div class="review-callout"><div><h2>Record a clinical observation</h2><p>Submit a signed knowledge, skill or attitude review for any resident.</p></div><button class="btn" data-go="write-review">Write a review</button></div>
        </section>
      </div>`);
  }
  const [r, assessmentStats, reviewStats, c] = await Promise.all([
    e.from("profiles").select("role,progression_status"),
    e.from("assessments").select("*", { head: !0, count: "exact" }),
    e.from("observer_reviews").select("*", { head: !0, count: "exact" }),
    e
      .from("assessment_schedules")
      .select("*", { head: !0, count: "exact" })
      .eq("is_active", !0)
      .gte("ends_at", new Date().toISOString()),
  ]);
  a.innerHTML =
    h(
      "Training program at a glance",
      "Controlled accounts, resident evidence and formal outcomes.",
      '<button class="btn" data-create>Create account</button>',
    ) +
    ` <div class="grid g4"> ${_("Residents", r.data?.filter((e) => "resident" === e.role).length || 0, "Active curriculum users")} ${_("Upcoming windows", c.count || 0, "Scheduled assessments")} ${_("Assessments", assessmentStats.count || 0, "Permanent history")} ${_("Observer reviews", reviewStats.count || 0, "Signed comments")} </div>`;
}
function A(e) {
  return ` <article class="card"> <div class="lead"> <div> <h2>Year ${e.assessed_year} ${o(e.assessment_type)}</h2> <p>${d(e.assessment_date)} · Assessor: ${o(e.assessor_signature)}</p> </div> <span class="tag ${e.overall_pass ? "success" : "danger"}">${e.overall_pass ? "Passed" : "Failed"}</span> </div> <div class="score"> <div><b>${e.knowledge_score}/10</b><small>Knowledge</small></div> <div><b>${e.skills_score}/10</b><small>Skills</small></div> <div><b>${e.attitude_score}/10</b><small>Attitude</small></div> <div><b>${e.total_score}/30</b><small>Total</small></div> </div> ${["knowledge", "skills", "attitude"].map((s) => (e[`${s}_justification`] ? `<p><b>${s}:</b> ${o(e[`${s}_justification`])}</p>` : "")).join("")} ${e.overall_pass ? "" : `<p class="warning">Reassessment due ${d(e.reassessment_due)}</p>`} </article>`;
}
function q(e, s = !1) {
  return ` <section class="card table-card"> <div class="table-scroll"> <table class="table"> <thead><tr> <th>Resident</th><th>Category</th><th>Comment</th><th>Date / place</th>${s ? "" : "<th>Observer</th>"} </tr></thead> <tbody>${e.map((e) => ` <tr> <td>${o(e.resident_name || e.resident?.display_name || "Resident")}</td> <td><span class="tag">${o(e.category)}</span></td> <td>${o(e.comment)}</td> <td>${d(e.observed_on)}<br>${o(e.place)}</td> ${s ? "" : `<td>${o(e.observer_signature)}</td>`} </tr>`).join("")}</tbody> </table> </div> </section>`;
}
async function S() {
  return e.rpc("assessor_assigned_residents");
}
function C(e) {
  return e.length
    ? ` <section class="card table-card"> <div class="table-scroll"> <table class="table"> <thead><tr><th>Resident</th><th>Assigned cohort</th><th></th></tr></thead> <tbody>${e.map((e) => ` <tr> <td>${o(e.resident_name || e.username)}</td> <td><span class="year-chip">Year ${e.residency_year}</span></td> <td><button class="btn" data-candidate="${e.resident_id}~">Open record</button></td> </tr>`).join("")}</tbody> </table> </div> </section>`
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
    ` <article class="item admin-item ${t.is_active ? "" : "inactive-item"}"> <div> <div class="item-title-row"> <h4>${o(t.title)}</h4> <span class="tag ${t.is_active ? "success" : "danger"}">${t.is_active ? "Active" : "Hidden"}</span> </div> <p>${o(t.description || "No description")}</p> <small>Order ${t.sort_order || 0}${"skill" === e ? ` · Expected level ${t.expected_level}` : ""}</small> </div> <button class="btn secondary" data-curriculum-edit="${a}">Edit</button> </article>`
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
  return ` <tr> <td data-label="Assessment"> <div class="schedule-title-cell"> <span class="tag ${a}">${t}</span> <div> <h3>${o(e.title)}</h3> ${e.location ? `<small>${o(e.location)}</small>` : ""} ${e.instructions ? `<p>${o(e.instructions)}</p>` : ""} </div> </div> </td> <td data-label="Cohort"> <strong>Year ${e.residency_year}</strong> <small>${"reassessment" === e.assessment_type ? "Reassessment" : "Initial assessment"}</small> </td> <td data-label="Window"> <div class="date-stack"> <span><b>Opens</b>${l(e.starts_at)}</span> <span><b>Closes</b>${l(e.ends_at)}</span> </div> </td> <td data-label="Scope"> <strong>${o(i.length ? i.join(" · ") : "Whole-year assessment")}</strong> <small>${o(r?.display_name || "Any assigned assessor")}</small> </td> <td class="schedule-action"><button class="btn secondary" data-schedule-edit="${e.id}">Edit</button></td> </tr>`;
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
      )} </select> </label> <label class="full">Location / method<input name="location" value="${o(e?.location || "")}" placeholder="e.g. Cardiology Department or online"></label> <label class="full">Instructions<textarea name="instructions">${o(e?.instructions || "")}</textarea></label> <label class="check-row full"><input name="is_active" type="checkbox" ${!1 !== e?.is_active ? "checked" : ""}> Active assessment window</label> </div> <input type="hidden" name="schedule_id" value="${e?.id || ""}"> <div class="actions"> <button type="button" class="btn secondary" data-close>Cancel</button> <button>${e ? "Save changes" : "Create schedule"}</button> </div> </form>`,
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
    e.assessor_id === s.p.id && e.assessor_status === "pending";
  const conferenceDetail = isConference
    ? `<p><b>Conference activity:</b> ${e.conference_participation === "gave_speech" ? "Gave a speech" : "Attended the conference"}</p><p><b>Conference name:</b> ${o(e.title)}</p>`
    : `<p><b>Intervention:</b> ${o(e.procedure_name || e.title)}</p><p><b>Participation:</b> ${o(e.participation_mode)}</p><p><b>Hospital:</b> ${o(e.hospital)}</p>`;
  const approvalDetail = isConference
    ? `<div class="approval-line"><b>Assessor:</b> ${o(e.assessor_name)} <span class="tag">${o(e.assessor_status)}</span>${e.assessor_note ? `<p><b>Note:</b> ${o(e.assessor_note)}</p>` : ""}</div>`
    : `<div class="approval-grid"><div class="approval-line"><b>Senior resident:</b> ${o(e.senior_resident_name)} <span class="tag">${o(e.senior_status)}</span>${e.senior_note ? `<p><b>Note:</b> ${o(e.senior_note)}</p>` : ""}</div><div class="approval-line"><b>Assessor:</b> ${o(e.assessor_name)} <span class="tag">${o(e.assessor_status)}</span>${e.assessor_note ? `<p><b>Note:</b> ${o(e.assessor_note)}</p>` : ""}</div></div>`;
  return ` <article class="card logbook-entry" data-logbook-status="${o(e.status)}" data-logbook-type="${o(e.activity_category)}"> <div class="lead"> <div><span class="eyebrow">${o(F[e.activity_type] || e.activity_type)}</span><h3>${o(e.title)}</h3><p>${d(e.activity_date)} · ${o(e.resident_name)} · Year ${o(e.residency_year)}</p></div> <span class="tag ${statusClass}">${o(e.status)}</span> </div> <div class="logbook-details">${conferenceDetail}${e.description ? `<p><b>Details:</b> ${o(e.description)}</p>` : ""}${approvalDetail}</div> ${canReviewSenior || canReviewAssessor ? `<div class="actions no-print"><button class="btn" data-logbook-review="${e.id}" data-logbook-title="${o(e.title)}">Approve or reject</button></div>` : ""} </article>`;
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
  "resident" === s.p.role && requests.push(e.rpc("logbook_approvers"));
  const [entriesResult, supervisorsResult] = await Promise.all(requests);
  if (entriesResult.error) throw entriesResult.error;
  const entries = entriesResult.data || [];
  const own = entries.filter((entry) => entry.resident_id === s.p.id);
  const assigned = entries.filter(
    (entry) =>
      entry.resident_id !== s.p.id &&
      (entry.senior_resident_id === s.p.id || entry.assessor_id === s.p.id),
  );
  const visible = "resident" === s.p.role ? own : entries;
  const approvers = supervisorsResult?.data || [];
  const seniorResidents = approvers.filter(
    (person) => person.approver_group === "senior_resident",
  );
  const assessors = approvers.filter(
    (person) => person.approver_group === "assessor",
  );
  const submitCard =
    "resident" === s.p.role
      ? ` <section class="card no-print"> <div class="card-heading"><span class="card-icon">＋</span><div><h3>Record an activity</h3><p>Required approvers receive separate Inbox requests.</p></div></div> <form id="logbookForm" class="form-grid"> <label class="full">Activity type<select name="activity_category" id="logbookCategory" required><option value="manual_intervention">Manual intervention</option><option value="conference">Conference</option></select></label><div class="full form-grid" id="manualFields"><label>Manual intervention<select name="procedure_name" required><option value="">Choose intervention</option>${["CVP", "Intubation", "Temporary pacemaker", "Pericardiocentesis", "Coronary angiography", "PCI"].map((item) => `<option>${item}</option>`).join("")}</select></label><label>Participation<select name="participation_mode" required><option value="">Choose participation</option><option value="solo">Solo</option><option value="assisted">Assisted</option></select></label><label>Activity date<input type="date" name="activity_date" max="${new Date().toISOString().slice(0, 10)}" required></label><label>Hospital<select name="hospital" required><option value="">Choose hospital</option><option value="Miri">Miri</option><option value="Smouha">Smouha</option></select></label><label>Senior resident<select name="senior_resident_id" required><option value="">Choose Year 3–5 senior resident</option>${seniorResidents.map((person) => `<option value="${person.id}">${o(person.display_name)} · Year ${person.residency_year}</option>`).join("")}</select></label><label>Assessor<select name="assessor_id" required><option value="">Choose assessor</option>${assessors.map((person) => `<option value="${person.id}">${o(person.display_name)}</option>`).join("")}</select></label></div><div class="full form-grid" id="conferenceFields" hidden><label>Conference role<select name="conference_participation" disabled required><option value="attended">Attendee</option><option value="gave_speech">Presenter</option></select></label><label>Conference name<input name="conference_name" minlength="3" maxlength="200" disabled required></label><label>Activity date<input type="date" name="activity_date" max="${new Date().toISOString().slice(0, 10)}" disabled required></label><label>Assessor<select name="assessor_id" disabled required><option value="">Choose assessor</option>${assessors.map((person) => `<option value="${person.id}">${o(person.display_name)}</option>`).join("")}</select></label></div><label class="full">Notes / evidence<textarea name="description" placeholder="Optional supporting details"></textarea></label><div class="full form-submit"><button>Submit for approval</button></div></form> </section>`
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
  a.innerHTML =
    h(
      "resident" === s.p.role
        ? "Resident e-logbook"
        : "Clinical activity logbooks",
      "resident" === s.p.role
        ? "Record procedures, conference attendance and lectures. Entries become verified after supervisor approval."
        : "Review assigned approval requests and monitor verified resident activity.",
      '<button class="btn secondary no-print" data-logbook-print>Export PDF</button>',
    ) +
    submitCard +
    (pending.length
      ? ` <section class="top-gap"><h2>Approval requests</h2><div class="grid top-gap">${pending.map(B).join("")}</div></section>`
      : "") +
    ` <section class="top-gap printable-logbook"><div class="lead"><div><h2>${"resident" === s.p.role ? "My activity history" : "Visible resident activity"}</h2><p>${visible.length} record${1 === visible.length ? "" : "s"}</p></div><div class="inline-actions no-print"><select id="logbookStatus"><option value="">All statuses</option><option value="approved">Approved</option><option value="pending">Pending</option><option value="rejected">Rejected</option></select><select id="logbookType"><option value="">All activities</option><option value="manual_intervention">Manual interventions</option><option value="conference">Conferences</option></select></div></div><div id="logbookEntries" class="grid top-gap">${visible.map(B).join("") || v("No logbook activities are available yet.")}</div></section>`;
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
    if ((a.hasAttribute("data-schedule-add") && O(), a.dataset.scheduleEdit)) {
      const e = s.schedules.get(a.dataset.scheduleEdit);
      e && O(e);
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
          ` <form id="reviewForm" class="modal"> <div class="modal-head"><h2>Review ${o(d)}</h2><button type="button" data-close>×</button></div> <div class="form-grid"> <label>Category<select name="category"><option>knowledge</option><option>skill</option><option>attitude</option></select></label> <label>Date<input type="date" name="observed_on" value="${new Date().toISOString().slice(0, 10)}" required></label> <label class="full">Place<input name="place" required></label> <label class="full">Comment<textarea name="comment" minlength="10" required></textarea></label> </div> <input type="hidden" name="resident_id" value="${r}"> <div class="actions"><button type="button" class="btn secondary" data-close>Cancel</button><button>Submit signed review</button></div> </form>`,
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
                          ` <label><input class="auto-width" type="checkbox" name="${e}_reasons" value="${s.id}"> ${o(s.label)}</label>`,
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
      a.hasAttribute("data-logbook-print") && window.print(),
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
      a.dataset.messageId &&
        (async () => {
          const key =
            a.dataset.messageBox === "sent"
              ? `sent-${a.dataset.messageId}`
              : a.dataset.messageId;
          const message = window.residentMessages?.get(String(key));
          if (!message) return;
          if (a.dataset.messageBox === "inbox" && !message.is_read)
            (await e.rpc("mark_private_message_read", {
              p_message_id: Number(message.id),
            }), await q());
          y(
            `<article class="modal message-view"><div class="modal-head"><div><span class="eyebrow">${a.dataset.messageBox === "inbox" ? "From" : "To"} ${o(a.dataset.messageBox === "inbox" ? message.sender_name : message.receiver_name)}</span><h2>${o(message.subject || "No subject")}</h2></div><button type="button" data-close>×</button></div><small>${l(message.created_at)}</small><p>${o(message.body).replace(/\n/g, "<br>")}</p>${a.dataset.messageBox === "inbox" ? `<div class="actions"><button class="btn" data-reply-to="${message.sender_id}">Reply</button></div>` : ""}</article>`,
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
      const { error: t } = await e
        .from("skill_levels")
        .upsert(
          { resident_id: s.p.id, skill_id: +a.dataset.level, level: +a.value },
          { onConflict: "resident_id,skill_id" },
        );
      t ? alert(t.message) : b("Level updated");
    }
    ("findYear" === a.id && R(),
      ("logbookStatus" === a.id || "logbookType" === a.id) && H(),
      "logbookDecision" === a.id && (() => {
        const note = document.querySelector('#logbookReviewForm textarea[name="note"]');
        const hint = document.querySelector("#logbookNoteHint");
        const rejected = a.value === "rejected";
        note.required = rejected;
        hint.textContent = rejected ? "Required for rejection" : "Optional for approval";
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
      "accountRole" === a.id && E(),
      "scheduleYear" === a.id && Y());
  }),
  document.addEventListener("input", (e) => {
    "findResident" === e.target.id &&
      (clearTimeout(window.residentSearchTimer),
      (window.residentSearchTimer = setTimeout(R, 250)));
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
        "reviewForm" === a.id &&
          u(
            await e.from("observer_reviews").insert({
              observer_id: s.p.id,
              resident_id: r.get("resident_id"),
              category: r.get("category"),
              observed_on: r.get("observed_on"),
              place: r.get("place"),
              comment: r.get("comment"),
              observer_signature: s.p.display_name,
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
      if ("messageForm" === a.id) {
        u(
          await e.rpc("send_private_message", {
            p_receiver_id: r.get("receiver_id"),
            p_subject: r.get("subject") || null,
            p_body: r.get("body"),
          }),
        );
        i.close();
        b("Message sent");
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
        const note = String(r.get("note") || "").trim();
        if (decision === "rejected" && note.length < 2)
          throw new Error("A note is required when rejecting an entry");
        u(
          await e.rpc("review_logbook_entry_v2", {
            p_entry_id: r.get("entry_id"),
            p_decision: decision,
            p_note: note,
          }),
        );
        await q();
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
