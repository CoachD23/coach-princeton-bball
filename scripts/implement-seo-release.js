const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const today = "2026-05-11";
const site = "https://coachprincetonbasketball.com";

function file(rel) {
  return path.join(root, rel);
}

function read(rel) {
  return fs.readFileSync(file(rel), "utf8");
}

function write(rel, text) {
  fs.mkdirSync(path.dirname(file(rel)), { recursive: true });
  fs.writeFileSync(file(rel), text);
}

function esc(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function updateHead(rel, meta) {
  let html = read(rel);
  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${esc(meta.title)}</title>`);
  html = html.replace(/<meta name="description" content="[^"]*" ?\/?>/i, `<meta name="description" content="${esc(meta.description)}">`);
  html = html.replace(/<meta property="og:title"\s+content="[^"]*" ?\/?>/i, `<meta property="og:title" content="${esc(meta.ogTitle || meta.title)}">`);
  html = html.replace(/<meta property="og:description"\s+content="[^"]*" ?\/?>/i, `<meta property="og:description" content="${esc(meta.description)}">`);
  html = html.replace(/<meta name="twitter:title"\s+content="[^"]*" ?\/?>/i, `<meta name="twitter:title" content="${esc(meta.twitterTitle || meta.ogTitle || meta.title)}">`);
  html = html.replace(/<meta name="twitter:description"\s+content="[^"]*" ?\/?>/i, `<meta name="twitter:description" content="${esc(meta.description)}">`);
  write(rel, html);
}

function ensureBefore(rel, marker, snippet, id) {
  let html = read(rel);
  if (html.includes(id)) return;
  if (!html.includes(marker)) throw new Error(`Marker not found in ${rel}: ${marker}`);
  html = html.replace(marker, `${snippet}\n${marker}`);
  write(rel, html);
}

function ensureAfter(rel, marker, snippet, id) {
  let html = read(rel);
  if (html.includes(id)) return;
  if (!html.includes(marker)) throw new Error(`Marker not found in ${rel}: ${marker}`);
  html = html.replace(marker, `${marker}\n${snippet}`);
  write(rel, html);
}

function jsonLd(data) {
  return `<script type="application/ld+json">\n${JSON.stringify(data, null, 2)}\n</script>`;
}

const faq = [
  {
    q: "What is the Princeton Offense?",
    a: "The Princeton Offense is a read-based basketball offense built on spacing, passing, backdoor cuts, high-post decisions, and counters that punish defensive overplays."
  },
  {
    q: "Is the Princeton Offense good for high school teams?",
    a: "Yes. High school teams can run the Princeton Offense by starting with simple Chin and Point reads, then adding counters after players understand spacing and timing."
  },
  {
    q: "How long does it take to install the Princeton Offense?",
    a: "Most teams can install the first usable package in two to three weeks. A complete system with counters and special situations usually takes four to six weeks."
  }
];

function faqSchema(items = faq) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a }
    }))
  };
}

function articleSchema(article) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${site}/` },
          { "@type": "ListItem", position: 2, name: "Blog", item: `${site}/blog/` },
          { "@type": "ListItem", position: 3, name: article.title, item: `${site}/${article.slug}/` }
        ]
      },
      {
        "@type": "BlogPosting",
        headline: article.title,
        description: article.description,
        author: { "@type": "Person", name: "Coach Lee DeForest", url: `${site}/about/` },
        publisher: { "@type": "Organization", name: "Coach Princeton Basketball", url: site },
        datePublished: today,
        dateModified: today,
        url: `${site}/${article.slug}/`,
        image: `${site}/og-image.jpg`,
        mainEntityOfPage: `${site}/${article.slug}/`,
        articleSection: article.category,
        keywords: article.keywords.join(", ")
      },
      faqSchema(article.faq)
    ]
  };
}

const pageMeta = {
  "index.html": {
    title: "Princeton Offense Playbook & PDF - Coach Lee DeForest",
    description: "Get Coach Lee DeForest's Princeton Offense playbook, PDF, videos, 42 drills, practice plans, six sets, and 14 counters for coaches."
  },
  "book/index.html": {
    title: "Princeton Offense PDF & Playbook | Coach Princeton",
    description: "Download the Princeton Offense PDF playbook with videos, practice plans, six sets, 14 counters, 42 drills, and instant access for coaches."
  },
  "princeton-offense-complete-guide/index.html": {
    title: "Princeton Offense Guide: Sets, Reads, Drills & History",
    description: "Learn the Princeton Offense: core rules, Chin, Low and Point sets, backdoor reads, counters, drills, history, and install sequence."
  },
  "how-to-run-the-princeton-offense/index.html": {
    title: "How to Run the Princeton Offense: Install Plan for Coaches",
    description: "A step-by-step Princeton Offense install plan with spacing rules, Chin entries, backdoor reads, counters, and practice structure."
  },
  "princeton-offense-plays/index.html": {
    title: "Princeton Offense Plays: Chin, Low, Point and Counters",
    description: "Princeton Offense plays and entries for Chin, Low, Point, Twirl, Five-Out, and X Set, with counters coaches can install."
  },
  "princeton-offense-drills/index.html": {
    title: "Princeton Offense Drills: Reads, Spacing and Timing",
    description: "Princeton Offense drills for teaching spacing, timing, passing reads, backdoor cuts, counters, and game-speed decisions."
  },
  "chin-set/index.html": {
    title: "Chin Set Princeton Offense: Reads, Entries and Drills",
    description: "Learn the Chin Set in the Princeton Offense: spacing, dribble-weave entries, backdoor reads, counters, and practice drills."
  },
  "basketball-practice-plan-template/index.html": {
    title: "Basketball Practice Plan Template for Coaches",
    description: "Use this 90-minute basketball practice plan template to organize skill work, team offense, defense, special situations, and review."
  }
};

for (const [rel, meta] of Object.entries(pageMeta)) {
  updateHead(rel, meta);
}

ensureAfter(
  "princeton-offense-complete-guide/index.html",
  '<div class="container">\n',
  `                <div id="seo-answer-block" style="background:rgba(201,168,76,0.08);border:1px solid rgba(201,168,76,0.24);border-radius:10px;padding:1.4rem 1.6rem;margin-bottom:2rem;color:#e8e0d0;line-height:1.8;">The Princeton Offense is a read-based basketball offense built on spacing, passing, backdoor cuts, and high-post decisions. Instead of memorizing set plays, players learn rules that tell them when to cut, screen, pass, or counter based on how the defense reacts.</div>\n`,
  "seo-answer-block"
);

ensureAfter(
  "how-to-run-the-princeton-offense/index.html",
  "<article class=\"article-wrap\">\n",
  `<div id="seo-answer-block" style="background:#111;border-left:4px solid #c9a84c;padding:1.25rem 1.5rem;margin-bottom:1.75rem;color:#e8e0d0;">To run the Princeton Offense, install spacing first, teach the Chin entry, drill backdoor reads daily, then add Point, Low, and counters only after players can read denial, help, and switching without a play call.</div>\n`,
  "seo-answer-block"
);

ensureAfter(
  "princeton-offense-plays/index.html",
  "<article class=\"article-wrap\">\n",
  `<div id="seo-answer-block" style="background:#111;border-left:4px solid #c9a84c;padding:1.25rem 1.5rem;margin-bottom:1.75rem;color:#e8e0d0;">The best Princeton Offense plays are not isolated calls. They are entries into Chin, Low, Point, Twirl, Five-Out, and X Set actions that teach players to read denial, backdoor openings, help-side rotations, and switching counters.</div>\n`,
  "seo-answer-block"
);

ensureAfter(
  "princeton-offense-drills/index.html",
  "<article class=\"article-wrap\">\n",
  `<div id="seo-answer-block" style="background:#111;border-left:4px solid #c9a84c;padding:1.25rem 1.5rem;margin-bottom:1.75rem;color:#e8e0d0;">Princeton Offense drills should train reads before patterns: spacing, passing angles, backdoor timing, high-post decisions, flare screens, and counters against pressure. The goal is to make players recognize the defense without waiting for a coach to call the next action.</div>\n`,
  "seo-answer-block"
);

ensureAfter(
  "chin-set/index.html",
  '<div class="container">\n',
  `                <div id="seo-answer-block" style="background:#111;border-left:4px solid #c9a84c;padding:1.25rem 1.5rem;margin-bottom:1.75rem;color:#e8e0d0;">The Chin Set is the foundation of the Princeton Offense because it teaches the offense's core language: guard-to-wing entry, high-post spacing, backdoor cuts, dribble-weave flow, and counters when defenders deny or switch.</div>\n`,
  "seo-answer-block"
);

const schemaInsertions = [
  {
    rel: "how-to-run-the-princeton-offense/index.html",
    id: "seo-howto-schema",
    data: {
      "@context": "https://schema.org",
      "@type": "HowTo",
      name: "How to Run the Princeton Offense",
      description: pageMeta["how-to-run-the-princeton-offense/index.html"].description,
      step: [
        { "@type": "HowToStep", name: "Install spacing rules", text: "Start with five-player spacing, passing angles, and high-post timing before adding set complexity." },
        { "@type": "HowToStep", name: "Teach Chin entry reads", text: "Use Chin as the first entry so players learn backdoor cuts, handoffs, and continuation reads." },
        { "@type": "HowToStep", name: "Drill counters", text: "Add counters against denial, switching, help-side rotation, and pressure after the first reads are automatic." }
      ]
    }
  },
  { rel: "princeton-offense-complete-guide/index.html", id: "seo-faq-schema", data: faqSchema() },
  { rel: "princeton-offense-drills/index.html", id: "seo-faq-schema", data: faqSchema([
    { q: "What should Princeton Offense drills teach first?", a: "They should teach spacing, timing, passing angles, and backdoor reads before adding full five-player continuity." },
    { q: "How often should teams drill Princeton reads?", a: "Teams should drill the core reads every practice, even after the offense is installed, because timing and recognition create the layups." },
    { q: "Are these drills only for advanced teams?", a: "No. Youth and high school teams can use simplified drills that isolate one read at a time before adding defense and counters." }
  ]) },
  { rel: "book/index.html", id: "seo-product-course-schema", data: {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Product",
        name: "Princeton Offense PDF Playbook",
        description: pageMeta["book/index.html"].description,
        brand: { "@type": "Brand", name: "Coach Princeton Basketball" },
        offers: { "@type": "Offer", price: "39", priceCurrency: "USD", availability: "https://schema.org/InStock", url: `${site}/book/` }
      },
      {
        "@type": "Course",
        name: "Princeton Offense Coaching System",
        description: "A digital coaching system for installing the Princeton Offense with playbook PDFs, videos, drills, counters, and practice plans.",
        provider: { "@type": "Organization", name: "Coach Princeton Basketball", sameAs: site },
        hasCourseInstance: { "@type": "CourseInstance", courseMode: "online" }
      }
    ]
  } }
];

for (const item of schemaInsertions) {
  ensureBefore(item.rel, "</body>", `<!-- ${item.id} -->\n${jsonLd(item.data)}\n`, item.id);
}

const articles = [
  {
    slug: "princeton-offense-rules",
    title: "Princeton Offense Rules: The 7 Reads Every Player Must Learn",
    seoTitle: "Princeton Offense Rules: 7 Reads Players Must Learn",
    description: "Teach the seven Princeton Offense rules that help players read denial, backdoor cuts, high-post passes, spacing, counters, and shot selection.",
    category: "Princeton Offense Rules",
    keywords: ["princeton offense rules", "princeton offense reads", "basketball offensive rules"],
    intro: "The Princeton Offense becomes hard to guard when players understand rules instead of memorizing choreography. These seven reads give your team a shared language for spacing, cuts, passes, and counters.",
    sections: [
      ["Rule 1: Spacing Creates the Read", "Keep the slots, wings, corners, and high post occupied with purpose. Poor spacing lets one defender guard two players; proper spacing stretches help defense and makes denial punishable."],
      ["Rule 2: Denial Means Backdoor", "When a defender takes away the catch, the cutter should not fight pressure in place. The answer is a sharp backdoor cut with eye contact, a target hand, and a passer ready to deliver on time."],
      ["Rule 3: The High Post Is a Decision Hub", "The high-post catch is not a pause point. It triggers handoffs, keeper reads, slips, flare screens, and opposite-side cuts. Teach the post to catch, chin the ball, and read cutters before dribbling."],
      ["Rule 4: Pass and Move With a Job", "Every pass should create the next problem for the defense. After moving the ball, players must cut, screen, replace, or space. Standing after a pass kills the offense."],
      ["Rule 5: Cutters Clear With Urgency", "Backdoor cuts only work when players finish their cuts and clear the lane. Lazy clears clog the next read and let the defense reset."],
      ["Rule 6: Counters Punish Adjustments", "If a defense switches, cheats, or sits in the lane, the offense should already have the counter. Teach counters as answers to specific defensive behavior, not as random extra plays."],
      ["Rule 7: The Best Shot Comes From the Read", "The Princeton Offense is not slow by default. It is patient until the defense makes a mistake, then aggressive. Layups, rhythm threes, and post seals are the shots worth hunting."]
    ],
    faq: [
      { q: "What is the most important Princeton Offense rule?", a: "The most important rule is that denial creates a backdoor opportunity. Once players understand that pressure can be punished, the offense becomes much harder to defend." },
      { q: "Should young teams learn all seven rules at once?", a: "No. Start with spacing, denial-backdoor, and pass-and-move rules. Add high-post and counter reads after the first habits are reliable." }
    ],
    related: ["how-to-run-the-princeton-offense", "princeton-offense-complete-guide", "book"]
  },
  {
    slug: "princeton-offense-install-plan-first-10-practices",
    title: "Princeton Offense Install Plan: First 10 Practices",
    seoTitle: "Princeton Offense Install Plan: First 10 Practices",
    description: "Use this 10-practice Princeton Offense install plan to teach spacing, Chin reads, backdoor timing, Point actions, counters, and practice review.",
    category: "Installation Plan",
    keywords: ["princeton offense install plan", "how to install princeton offense", "princeton offense practice plan"],
    intro: "A clean install beats a fast install. This 10-practice plan gives coaches a sequence that builds habits first, then adds actions and counters without flooding players with terminology.",
    sections: [
      ["Practices 1-2: Spacing and Passing Angles", "Teach the floor spots, high-post target area, wing spacing, slot spacing, and the rule that every pass requires movement. Use shell spacing before adding defense."],
      ["Practices 3-4: Chin Entry and Backdoor Timing", "Install the Chin entry, guard-to-wing pass, high-post flash, and first backdoor read. Drill the passer's footwork and the cutter's timing until the pass arrives before help rotates."],
      ["Practices 5-6: Continuation and Reversal", "Add the second side of the action. Players should learn how to clear, replace, reverse the ball, and flow into another read without stopping the possession."],
      ["Practice 7: Point Set Introduction", "Introduce Point only after Chin spacing is clean. Teach over, under, and away reads as the next layer, not a separate offense."],
      ["Practice 8: Low Set and Post Decisions", "Use Low to change angles and involve the post. The post should read cutters, handoffs, and seals instead of becoming a stationary scorer."],
      ["Practice 9: Defensive Counters", "Show the team how the offense answers denial, switching, overhelp, and zone looks. Keep each counter tied to the defensive trigger that creates it."],
      ["Practice 10: Controlled Scrimmage and Review", "Run scored possessions with constraints: one backdoor read per possession, one high-post touch, and no empty passes. Review film for timing and spacing mistakes."]
    ],
    faq: [
      { q: "Can I install the Princeton Offense in two weeks?", a: "You can install a playable package in two weeks if you focus on spacing, Chin reads, and a few counters instead of trying to teach every set." },
      { q: "Which Princeton set should I teach first?", a: "Start with the Chin Set because it teaches the most important reads: entry, backdoor, high-post decisions, and continuation." }
    ],
    related: ["how-to-run-the-princeton-offense", "princeton-offense-practice-plan", "book"]
  },
  {
    slug: "princeton-offense-diagrams",
    title: "Princeton Offense Diagrams: Chin, Point, Low and Twirl",
    seoTitle: "Princeton Offense Diagrams: Chin, Point, Low, Twirl",
    description: "Study Princeton Offense diagrams for Chin, Point, Low, and Twirl actions with coaching cues for spacing, timing, cuts, and counters.",
    category: "Play Diagrams",
    keywords: ["princeton offense diagrams", "princeton offense plays diagrams", "chin point low twirl"],
    intro: "Diagrams are useful only when they teach the read behind the movement. Use these text diagrams as coaching maps for the four Princeton actions most teams should understand first.",
    sections: [
      ["Chin Diagram: Guard Entry and Backdoor", "Start with two guards high, wings wide, and the post near the elbow. The first guard-to-wing pass triggers the opposite guard's cut off the high-post screen. If denied, the cutter goes backdoor."],
      ["Point Diagram: Over, Under, Away", "The guard enters to the high post or slot, then reads the defender. Over creates a handoff lane, under creates a backdoor window, and away creates weak-side movement."],
      ["Low Diagram: Post Entry Angles", "The Low Set moves the decision closer to the block and elbow area. It helps teams with a skilled post or bigger guard create inside-out reads without abandoning Princeton principles."],
      ["Twirl Diagram: Continuous Rotation", "Twirl uses rotation and replacement to keep defenders moving. It is useful after the defense has adjusted to simple Chin or Point timing."],
      ["How to Teach Diagrams Without Freezing Players", "Show the diagram, walk the first pass, then remove the paper. Players should learn the trigger and the read, not just the path on the page."]
    ],
    faq: [
      { q: "Do Princeton Offense diagrams work without video?", a: "Yes, but diagrams should be paired with walk-through reps and live reads so players learn timing instead of memorized routes." },
      { q: "Which diagram should coaches install first?", a: "The Chin diagram should come first because it teaches the foundation for backdoor cuts, high-post reads, and continuation." }
    ],
    related: ["princeton-offense-plays", "chin-set", "book"]
  },
  {
    slug: "princeton-offense-vs-2-3-zone",
    title: "Princeton Offense vs 2-3 Zone: Spacing, Flashes and Counters",
    seoTitle: "Princeton Offense vs 2-3 Zone: Spacing & Counters",
    description: "Attack a 2-3 zone with Princeton Offense spacing, high-post flashes, short-corner touches, reversals, backdoor timing, and zone counters.",
    category: "Zone Adjustments",
    keywords: ["princeton offense vs 2-3 zone", "princeton offense against zone", "zone offense basketball"],
    intro: "A 2-3 zone tries to slow your reads by protecting the lane. Princeton principles still work if you keep the ball moving, flash the high post, and make the zone guard two actions at once.",
    sections: [
      ["Start With Wider Spacing", "Place shooters high enough to stretch the top two defenders and wide enough to make wing closeouts longer. The goal is to create seams before the ball reaches the high post."],
      ["Use the High Post as the Pressure Point", "A high-post catch forces the middle defender to step up. Once that happens, short-corner passes, opposite cuts, and kickout threes become available."],
      ["Flash Behind the Top Line", "Do not stand in the gaps. Flash behind the top two defenders as the ball reverses so the passer can hit the seam before the zone shifts."],
      ["Attack the Short Corner", "The short corner makes the back line choose between protecting the rim and closing out. From there, teach the player to read baseline cutter, high post, and opposite wing."],
      ["Keep Backdoor Timing Alive", "Zones still overextend. When the top defender chases a wing catch or denies reversal, the backdoor cut can punish the gap behind the pressure."],
      ["Finish With Offensive Rebounding Rules", "Zone possessions often end with long rebounds. Assign crash and safety rules so Princeton spacing does not become a rebounding disadvantage."]
    ],
    faq: [
      { q: "Can the Princeton Offense beat a 2-3 zone?", a: "Yes. It works best when the offense uses high-post flashes, short-corner touches, fast reversals, and disciplined spacing instead of standing around the perimeter." },
      { q: "What is the first zone adjustment to teach?", a: "Teach high-post flashes first because they force the zone to collapse and create the next pass." }
    ],
    related: ["princeton-offense-against-zone-defense", "zone-offense-basketball", "book"]
  },
  {
    slug: "best-players-for-princeton-offense",
    title: "Best Players for the Princeton Offense by Position",
    seoTitle: "Best Players for the Princeton Offense by Position",
    description: "Learn the player traits that make the Princeton Offense work: passing posts, smart cutters, patient guards, shooters, and high-IQ role players.",
    category: "Player Fit",
    keywords: ["best players for princeton offense", "princeton offense positions", "princeton offense player roles"],
    intro: "The Princeton Offense does not require the most athletic roster in the league. It rewards players who pass, cut, read, screen, and stay patient enough to punish defensive mistakes.",
    sections: [
      ["Point Guards: Patient Organizers", "The point guard must value the first good read over the first quick shot. Passing accuracy, poise under pressure, and timing matter more than isolation scoring."],
      ["Wings: Cutters Who Can Shoot", "Wings must make defenses pay for denial. The best wings can hit open threes, cut hard backdoor, and clear space without needing the ball every possession."],
      ["Posts: Passers First, Scorers Second", "A passing post unlocks the offense. The post should catch at the elbow, read cutters, hand off under control, and score only when the defense forgets the threat."],
      ["Forwards: Screeners and Connectors", "Forwards need to screen with angles, slip when defenders cheat, and keep the ball moving. A connector can make the offense feel faster without forcing shots."],
      ["Bench Players: Rule Followers", "Role players can thrive because the system gives them clear reads. If they space, cut, and pass on time, they become hard to guard."],
      ["Roster Red Flags", "The hardest players to fit are ball-stoppers, reluctant passers, and cutters who jog through reads. Those habits must be addressed before adding more sets."]
    ],
    faq: [
      { q: "Do you need great shooters for the Princeton Offense?", a: "You need enough shooting to punish sagging defenders, but timing, passing, and cutting are the first requirements." },
      { q: "Can a team without a skilled post run Princeton?", a: "Yes, but it should use more five-out and Point actions while developing a high-post passer over time." }
    ],
    related: ["princeton-offense-high-school", "five-out-princeton-offense", "book"]
  },
  {
    slug: "princeton-offense-mistakes",
    title: "Princeton Offense Mistakes: 12 Fixes for Coaches",
    seoTitle: "Princeton Offense Mistakes: 12 Coaching Fixes",
    description: "Fix common Princeton Offense mistakes including bad spacing, late backdoor cuts, overdribbling, weak high-post reads, and poor counter timing.",
    category: "Coaching Fixes",
    keywords: ["princeton offense mistakes", "princeton offense coaching tips", "fix princeton offense"],
    intro: "Most Princeton Offense problems are not system problems. They are teaching-sequence problems. These fixes help coaches diagnose why the offense looks slow, crowded, or predictable.",
    sections: [
      ["Mistake 1: Teaching Too Many Sets", "Fix it by installing one entry and one counter first. Players need confidence in the first read before they can handle variety."],
      ["Mistake 2: Poor Wing Spacing", "Fix it by marking spots in practice and freezing possessions when one defender can guard two offensive players."],
      ["Mistake 3: Late Backdoor Cuts", "Fix it by teaching the cutter to leave on denial, not after the passer stares them down."],
      ["Mistake 4: Passive High-Post Catches", "Fix it by giving the post a three-read checklist: cutter, handoff, keeper. No catch should become a dead spot."],
      ["Mistake 5: Overdribbling", "Fix it with no-dribble segments that force passing angles, cuts, and catches before live play."],
      ["Mistake 6: Counters Without Triggers", "Fix it by naming the defensive behavior before the counter. Players should know why the counter appears."],
      ["Mistake 7: Weak Film Review", "Fix it by grading spacing, timing, and decision quality instead of only makes and misses."]
    ],
    faq: [
      { q: "Why does my Princeton Offense look slow?", a: "It usually looks slow when players are waiting for the next pattern instead of reading the defense. Re-teach triggers and simplify the package." },
      { q: "How do I fix poor backdoor timing?", a: "Drill denial recognition, passer eye discipline, and cutter pace separately before putting them back into five-on-five play." }
    ],
    related: ["princeton-offense-rules", "princeton-offense-drills", "book"]
  },
  {
    slug: "princeton-offense-practice-drills-by-skill-level",
    title: "Princeton Offense Practice Drills by Skill Level",
    seoTitle: "Princeton Offense Drills by Skill Level",
    description: "Choose Princeton Offense practice drills for youth, middle school, high school, and advanced teams with progressions for reads and counters.",
    category: "Drills and Practice",
    keywords: ["princeton offense practice drills", "princeton offense drills by level", "basketball read drills"],
    intro: "The right drill depends on the team's current skill level. A youth team needs spacing and cutting habits; an advanced team needs counters, pressure reads, and late-clock execution.",
    sections: [
      ["Youth Level: Spacing and Catching", "Use three-player passing, basket cuts, and replace drills. Keep the teaching language simple: pass, cut, fill, and see the ball."],
      ["Middle School Level: Denial Reads", "Add guided defense. The defender either allows the catch or denies it. The offensive player learns to catch if open and cut backdoor if denied."],
      ["High School Level: Chin Breakdown", "Run four-player Chin breakdowns with a passer, cutter, screener, and receiver. Add scoring consequences for late cuts or crowded spacing."],
      ["Advanced Level: Counter Recognition", "Let the defense switch, overplay, or help early. The offense must name and execute the counter without a coach stopping the action."],
      ["Team Segment: Five-on-Five Constraints", "Use constraints such as one high-post touch before a shot or one backdoor read every possession. Constraints create habits faster than speeches."],
      ["Evaluation: What to Track", "Track clean catches, paint touches, backdoor attempts, turnovers from spacing errors, and possessions that create an advantage before the shot."]
    ],
    faq: [
      { q: "What Princeton drill should beginners start with?", a: "Beginners should start with pass-cut-fill spacing and denial-backdoor drills before full Chin or Point actions." },
      { q: "How do advanced teams keep improving?", a: "Advanced teams should practice counters against live defensive choices so players learn to recognize pressure, switching, and help." }
    ],
    related: ["princeton-offense-drills", "backdoor-cut-basketball-drill", "book"]
  },
  {
    slug: "princeton-offense-installation-checklist",
    title: "Princeton Offense Installation Checklist for Coaches",
    seoTitle: "Princeton Offense Installation Checklist",
    description: "Use this Princeton Offense installation checklist to confirm spacing, reads, counters, practice drills, player roles, and game adjustments.",
    category: "Installation Checklist",
    keywords: ["princeton offense installation checklist", "princeton offense checklist", "princeton offense coaching checklist"],
    intro: "Use this checklist before the first game, after every week of practice, and whenever the offense starts to drift. It keeps the system tied to teachable habits instead of vague execution goals.",
    sections: [
      ["Spacing Checklist", "Can every player identify the slot, wing, corner, high-post, and replacement spots? Can they explain why spacing changes the read?"],
      ["Passing Checklist", "Can guards deliver the wing pass, backdoor pass, and high-post entry without telegraphing? Can the post catch and pivot under pressure?"],
      ["Cutting Checklist", "Are cutters leaving on denial? Are they clearing fully? Are weak-side players replacing with timing instead of standing?"],
      ["Set Checklist", "Can the team run Chin cleanly? Can it flow into Point or Low without stopping? Does each set have a clear first read?"],
      ["Counter Checklist", "Does the team have answers for denial, switching, zone, pressure, and overhelp? Can players connect each counter to the defensive trigger?"],
      ["Game Checklist", "Do you know which two reads you want early, which counter you trust late, and which lineup executes the offense with the fewest empty passes?"]
    ],
    faq: [
      { q: "When should coaches use the installation checklist?", a: "Use it before scrimmages, before the first game, and anytime the offense becomes crowded, slow, or turnover-prone." },
      { q: "What is the most important checklist item?", a: "Spacing is first. Without spacing, the backdoor cuts, high-post reads, and counters all become easier to defend." }
    ],
    related: ["princeton-offense-install-plan-first-10-practices", "how-to-run-the-princeton-offense", "book"]
  }
];

const extraSections = {
  "princeton-offense-rules": [
    ["How to Teach the Rules in Practice", "Do not introduce all seven rules as a lecture. Put players in a three-on-three shell, give the defense one behavior, and make the offense solve it. If the defender denies, the cutter goes backdoor. If help steps up, the next player spaces behind the help. Short, repeated reps make the rules feel like basketball instead of vocabulary."],
    ["Film Review Checklist", "When reviewing film, grade the rule before the result. A made contested jumper can still be a bad Princeton possession if the backdoor window was ignored. A missed layup can be a good possession if the team created the right read. This keeps players focused on decision quality instead of only shot outcome."],
    ["How These Rules Connect to the Playbook", "The rules are the reason the Chin, Low, Point, Twirl, Five-Out, and X Set pages all fit together. Coaches should use the rules as the common language, then use each set as a different way to create the same reads. That is what keeps the offense from becoming a pile of unrelated plays."],
    ["Common Teaching Mistake", "The biggest mistake is correcting the player with the ball while ignoring the other four players. In the Princeton Offense, the passer may look wrong because the cutter was late, the spacer drifted, or the high-post player failed to present a target. Coach the full five-player picture."]
  ],
  "princeton-offense-install-plan-first-10-practices": [
    ["Daily Practice Structure", "Each practice should include a five-minute spacing warmup, a ten-minute read breakdown, a ten-minute set segment, and a live constraint segment. The constraint matters: require one high-post touch, one backdoor attempt, or one reversal before the shot. This turns the install plan into habits instead of walkthrough theater."],
    ["When to Slow Down the Install", "Slow down if players cannot name the read that created the shot. If the team can run the pattern but cannot explain why the cut happened, the install is moving too fast. Stay on Chin and the first counter until the players recognize denial, overhelp, and switching without coach narration."],
    ["Game-Week Adjustment", "During game week, reduce new teaching and increase recognition reps. Show the defense your opponent plays most often, then let the offense solve it from Chin, Point, and Low. The goal is not to show every page of the playbook. The goal is to trust two or three reads under pressure."],
    ["Staff Alignment", "Before practice, every coach should use the same language for the reads. One coach calling it a backdoor trigger while another calls it a pressure cut creates hesitation. Write the terms on the practice plan and correct with the same phrases every day."]
  ],
  "princeton-offense-diagrams": [
    ["Using Diagrams With Players", "Show one diagram, then immediately walk it on the floor. Players should point to the defender they are reading before they move. This prevents the common problem where athletes memorize arrows but fail to recognize why the arrow exists. Diagrams are a starting point, not the lesson."],
    ["Diagram Progression", "Start with Chin because it teaches the cleanest backdoor window. Add Point once the high-post reads are reliable. Add Low when you want post-entry angles and inside-out touches. Add Twirl when the team can keep spacing while players rotate. That progression keeps the diagrams connected."],
    ["What to Add to Every Diagram", "Every Princeton diagram should include the ball, the cutter, the high-post decision point, the weak-side replacement, and the defensive trigger. If the diagram only shows offensive movement, it is incomplete. The defense is what tells the offense which option is correct."],
    ["From Diagram to Live Play", "After a diagram walk-through, use guided defense before going live. Tell the defender to deny once, trail once, and switch once. The offense must choose the correct answer. This bridge keeps the diagram from falling apart when the defense stops cooperating."]
  ],
  "princeton-offense-vs-2-3-zone": [
    ["Practice Segment for Zone Prep", "Use five-on-five zone shell with no shooting for the first three minutes. The offense scores a point for a high-post catch, a short-corner touch, or a paint pass. This teaches the team to value zone distortion before the shot and keeps players from settling for early perimeter jumpers."],
    ["Best Lineup Traits Against a 2-3 Zone", "Your best zone lineup usually has two passers, two corner threats, and one player comfortable catching in the middle. The middle player does not need to be your tallest athlete. A calm decision-maker who can pivot, pass, and hit a short jumper may be more valuable."],
    ["Common Zone Mistake", "The most common mistake is passing around the outside without forcing the zone to turn its head. Princeton zone offense should still create decisions: flash, cut behind the top line, hit the short corner, and reverse before the defense resets. Perimeter passing alone does not punish the zone."],
    ["How to Connect This to the Base Offense", "Do not install a completely separate zone offense if you can avoid it. Keep Princeton spacing language, keep high-post reads, and adjust where players flash and replace. The more the zone package feels like the base offense, the faster players will trust it in games."]
  ],
  "best-players-for-princeton-offense": [
    ["Evaluating Your Current Roster", "Before choosing your first set, grade players on passing, cutting, screening, shooting, decision speed, and patience. The Princeton Offense is flexible, but your first install should fit your best decision-makers. A team with a passing post may start differently than a team with three guards."],
    ["Player Development Priorities", "Guards should work on entry passing, pivoting, and rejecting pressure. Wings should work on backdoor footwork, corner shooting, and reading help. Posts should work on catching at the elbow, handing off, and passing to cutters. Each role has a skill plan, not just a position label."],
    ["Who Struggles in This Offense", "Players who need the ball to stay engaged can struggle early. So can athletes who cut only when they expect to shoot. The fix is accountability: every cut, screen, pass, and replacement must have a purpose. Reward the player who creates the advantage, not only the player who finishes it."],
    ["How to Sell the System to Players", "Explain that the offense creates touches for everyone, but not random touches. Players earn shots by making the correct read, spacing with discipline, and punishing defensive mistakes. When athletes understand that smart movement gets them layups and rhythm threes, buy-in improves quickly."]
  ],
  "princeton-offense-mistakes": [
    ["How to Diagnose the Real Problem", "When a possession breaks down, ask what happened first. Was spacing wrong before the pass? Was the cutter late before the turnover? Did the high post catch and hold? Fixing the first mistake is more useful than reacting to the final miss or giveaway."],
    ["Practice Fix: Freeze and Rewind", "Use a freeze-and-rewind method in live practice. Stop the action at the mistake, move players back two passes, and replay the read at half speed. Then run it live. This connects correction to the exact moment the decision should have happened."],
    ["Mistakes That Look Like Effort Problems", "Some Princeton mistakes look like poor effort but are actually recognition problems. A player may jog through a cut because they do not believe the pass is available. Show them the window on film, then drill the same read until they trust it."],
    ["Mistakes That Require Simplifying", "If the team keeps making the same error, remove a layer. Run Chin without counters, Point without the second option, or five-on-five with no dribble. Simplifying is not going backward. It is how you rebuild the habit that makes the full offense work."]
  ],
  "princeton-offense-practice-drills-by-skill-level": [
    ["How to Move Up a Level", "Move to the next drill level only when the current level works against guided defense. If players can execute against air but panic when a defender denies, stay with the denial drill. Progression should be based on recognition, not the calendar."],
    ["Scoring the Drills", "Give points for the behavior you want. Award one point for a correct backdoor read, one point for a high-post touch, and one point for a clean replacement. Subtract points for spacing violations or empty dribbles. The scoreboard makes invisible habits visible."],
    ["Building a Weekly Drill Menu", "A weekly drill menu should include one spacing drill, one passing drill, one cutting drill, one high-post drill, and one live counter drill. Rotate the details, but keep the categories stable. Consistency helps players see how each drill connects to the offense."],
    ["Keeping Drills Competitive", "Make the defense earn stops by taking away the first option. If the defense simply stands in a shell, the offense never learns to solve pressure. Competitive Princeton drills should force both sides to think, adjust, and communicate."]
  ],
  "princeton-offense-installation-checklist": [
    ["How to Use the Checklist With Staff", "Give each assistant one category during practice: spacing, passing, cutting, counters, or game execution. At the end of practice, compare notes and choose the single biggest correction for tomorrow. This keeps the checklist practical instead of becoming a long list nobody acts on."],
    ["Preseason Checklist Priorities", "In preseason, prioritize spacing, terminology, and the first two reads. Players should know where to stand, what the first trigger means, and how to clear after a cut. Counters can wait until the base shape is reliable."],
    ["In-Season Checklist Priorities", "During the season, use the checklist to prevent drift. Teams often start spacing too tightly, cutting too late, or skipping the high-post touch. A short weekly checklist review catches those habits before they become game-night turnovers."],
    ["Game-Day Checklist", "Before tipoff, know your first entry, your best counter, your zone answer, and your late-clock option. The checklist should make the staff calmer. When the defense changes, you already know which Princeton answer you trust."]
  ]
};

function renderArticle(article) {
  const relatedLinks = article.related.map((slug) => {
    const href = slug === "book" ? "/book/" : `/${slug}/`;
    const label = slug === "book" ? "Download the Princeton Offense PDF Playbook" : slug.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
    return `<li><a href="${href}">${label}</a></li>`;
  }).join("\n          ");
  const combinedSections = article.sections.concat(extraSections[article.slug] || []);
  const body = combinedSections.map(([heading, text]) => `<h2>${heading}</h2>\n<p>${text}</p>`).join("\n\n");
  const implementationBlock = `<h2>How to Use This Resource This Week</h2>
<p>Pick one idea from this ${article.category.toLowerCase()} resource and build it into your next practice plan. Start with a short walk-through, then add guided defense, then finish with a live segment where the defense is allowed to take away the first option. The Princeton Offense improves when players connect the concept to a defensive trigger, not when they simply memorize where to run.</p>
<p>For example, if the focus is spacing, freeze the possession whenever one defender can guard two players. If the focus is a backdoor read, give the defender permission to deny and require the passer to deliver the ball on time. If the focus is a counter, make the defense switch, help, or sit in a zone so the offense has to recognize the answer under pressure.</p>
<p>This page should work as a teaching layer, not a standalone system. Use it with the <a href="/princeton-offense-complete-guide/">complete Princeton Offense guide</a>, the <a href="/how-to-run-the-princeton-offense/">installation plan</a>, and the <a href="/book/">Princeton Offense PDF playbook</a> so your team has the full progression: concept, drill, set, counter, and game application.</p>`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(article.seoTitle || article.title)}</title>
  <meta name="description" content="${esc(article.description)}">
  <meta name="robots" content="index, follow">
  <meta name="author" content="Coach Lee DeForest">
  <link rel="canonical" href="${site}/${article.slug}/">
  <meta property="og:type" content="article">
  <meta property="og:title" content="${esc(article.title)}">
  <meta property="og:description" content="${esc(article.description)}">
  <meta property="og:url" content="${site}/${article.slug}/">
  <meta property="og:image" content="${site}/og-image.jpg">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(article.title)}">
  <meta name="twitter:description" content="${esc(article.description)}">
  <meta name="twitter:image" content="${site}/og-image.jpg">
  <link rel="stylesheet" href="/fonts/inter.css">
  <style>
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Inter,Arial,sans-serif;background:#0a0a0a;color:#e8e0d0;line-height:1.75}
    nav{background:#111;border-bottom:2px solid #c9a84c;padding:.85rem 1.5rem;display:flex;gap:1.4rem;flex-wrap:wrap;align-items:center}
    nav a{color:#c9a84c;text-decoration:none;font-size:.88rem;font-weight:700;text-transform:uppercase;letter-spacing:.04em}
    nav a:hover{text-decoration:underline}
    .brand{font-size:1rem;color:#fff}
    .hero{background:linear-gradient(135deg,#111 0%,#1a1a1a 100%);border-bottom:1px solid rgba(201,168,76,.45);padding:3.5rem 1.5rem 2.5rem;text-align:center}
    .eyebrow{color:#c9a84c;font-size:.78rem;text-transform:uppercase;letter-spacing:.12em;font-weight:800;margin-bottom:.75rem}
    h1{max-width:900px;margin:0 auto .8rem;color:#fff;font-size:clamp(2rem,5vw,3.2rem);line-height:1.12}
    .meta{color:#999;font-size:.9rem}
    article{max-width:820px;margin:0 auto;padding:2.5rem 1.5rem 4rem}
    .answer{background:#111;border-left:4px solid #c9a84c;padding:1.25rem 1.5rem;margin-bottom:2rem;color:#f1ead9;font-size:1.05rem}
    h2{color:#c9a84c;font-size:1.55rem;margin:2.25rem 0 .75rem}
    p{margin-bottom:1.2rem;color:#d7d0c2}
    a{color:#c9a84c}
    .table{width:100%;border-collapse:collapse;margin:2rem 0;background:#111}
    .table th,.table td{border:1px solid rgba(201,168,76,.25);padding:.8rem;text-align:left;vertical-align:top}
    .table th{color:#c9a84c}
    .cta{margin:3rem 0 0;padding:2rem;background:linear-gradient(135deg,rgba(201,168,76,.12),rgba(201,168,76,.04));border:1px solid rgba(201,168,76,.32);border-radius:10px;text-align:center}
    .cta h2{margin-top:0;color:#fff}
    .btn{display:inline-block;background:#c9a84c;color:#0a0a0a;text-decoration:none;font-weight:800;padding:.9rem 1.6rem;border-radius:7px;margin-top:.5rem}
    .related{max-width:820px;margin:0 auto 4rem;padding:1.5rem;background:#111;border:1px solid rgba(201,168,76,.18);border-radius:10px}
    .related h2{margin-top:0;color:#fff;font-size:1.2rem}
    .related ul{margin-left:1.2rem}
    footer{border-top:1px solid #222;text-align:center;color:#777;padding:1.5rem;font-size:.85rem}
  </style>
  ${jsonLd(articleSchema(article))}
</head>
<body>
  <nav>
    <a class="brand" href="/">Coach Princeton Basketball</a>
    <a href="/princeton-offense-complete-guide/">Guide</a>
    <a href="/how-to-run-the-princeton-offense/">Install</a>
    <a href="/princeton-offense-plays/">Plays</a>
    <a href="/princeton-offense-drills/">Drills</a>
    <a href="/book/">Playbook</a>
  </nav>
  <header class="hero">
    <div class="eyebrow">${esc(article.category)}</div>
    <h1>${esc(article.title)}</h1>
    <p class="meta">By Coach Lee DeForest | Published ${today} | Princeton Offense coaching resource</p>
  </header>
  <article>
    <div class="answer">${esc(article.intro)}</div>
    ${body}
    ${implementationBlock}
    <table class="table">
      <thead><tr><th>Coach's checkpoint</th><th>What to look for</th></tr></thead>
      <tbody>
        <tr><td>Spacing</td><td>One defender should not be able to guard two offensive players.</td></tr>
        <tr><td>Timing</td><td>Cuts and passes should happen as the defender commits, not after the window closes.</td></tr>
        <tr><td>Decision</td><td>Players should be able to name the defensive trigger that created the read.</td></tr>
      </tbody>
    </table>
    <div class="cta">
      <h2>Need the complete Princeton Offense package?</h2>
      <p>Get the 87-page Princeton Offense PDF playbook, video walkthroughs, practice plans, six sets, 14 counters, and 42 drills.</p>
      <a class="btn" href="/book/">Download the Playbook - $39</a>
    </div>
  </article>
  <aside class="related">
    <h2>Related Princeton Offense Resources</h2>
    <ul>
      ${relatedLinks}
    </ul>
  </aside>
  <footer>&copy; 2026 Coach Princeton Basketball. All rights reserved.</footer>
</body>
</html>
`;
}

for (const article of articles) {
  write(`${article.slug}/index.html`, renderArticle(article));
}

const newBlogCards = `        <!-- SEO Domination Sprint Resources -->
        <section class="blog-section" id="seo-domination-sprint">
            <div class="silo-header">
                <h2 class="category-title">Princeton Offense Installation Sprint</h2>
                <p class="silo-description">New coaching resources built to help teams install the Princeton Offense, diagnose mistakes, teach reads, and choose the right player roles.</p>
            </div>
            <div class="blog-grid">
                ${articles.map((article) => `<a href="/${article.slug}/" class="blog-card">
                    <div class="blog-header"><div class="blog-header-content"><span class="blog-category">${esc(article.category)}</span><h3 class="blog-title">${esc(article.title)}</h3></div></div>
                    <div class="blog-content"><div class="blog-meta">Coach Lee DeForest · ${today}</div><p class="blog-excerpt">${esc(article.description)}</p><span class="blog-link">Read Article -></span></div>
                </a>`).join("\n                ")}
            </div>
        </section>\n\n`;

ensureBefore("blog/index.html", "        <!-- Featured Pillar Post -->", newBlogCards, "seo-domination-sprint");

function updateSitemap() {
  let xml = read("sitemap.xml");
  const touched = new Set([
    "/",
    "/book/",
    "/blog/",
    "/princeton-offense-complete-guide/",
    "/how-to-run-the-princeton-offense/",
    "/princeton-offense-plays/",
    "/princeton-offense-drills/",
    "/chin-set/",
    "/basketball-practice-plan-template/"
  ]);
  for (const article of articles) {
    touched.add(`/${article.slug}/`);
    if (xml.includes(`${site}/${article.slug}/`)) continue;
    const entry = `  <url>
    <loc>${site}/${article.slug}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
`;
    xml = xml.replace("</urlset>", `${entry}</urlset>`);
  }
  xml = xml.replace(/<url>([\s\S]*?)<\/url>/g, (block) => {
    const loc = block.match(/<loc>https:\/\/coachprincetonbasketball\.com(\/[^<]*)<\/loc>/);
    if (!loc || !touched.has(loc[1])) return block;
    return block.replace(/<lastmod>[^<]+<\/lastmod>/, `<lastmod>${today}</lastmod>`);
  });
  write("sitemap.xml", xml);
}

updateSitemap();

const redirects = [
  "/princeton-offense-2-3-zone          /princeton-offense-vs-2-3-zone/  301",
  "/princeton-offense-2-3-zone/         /princeton-offense-vs-2-3-zone/  301",
  "/princeton-offense-install-plan      /princeton-offense-install-plan-first-10-practices/  301",
  "/princeton-offense-install-plan/     /princeton-offense-install-plan-first-10-practices/  301"
];
let redirectsText = read("_redirects");
for (const line of redirects) {
  if (!redirectsText.includes(line.split(/\s+/)[0])) {
    redirectsText = redirectsText.replace("# -----------------------------------------------\n# 404 fallback", `${line}\n# -----------------------------------------------\n# 404 fallback`);
  }
}
write("_redirects", redirectsText);

const seedKeywords = [
  ["playbook_pdf", "princeton offense pdf", "book"],
  ["playbook_pdf", "princeton offense playbook", "home"],
  ["playbook_pdf", "princeton offense playbook pdf", "book"],
  ["playbook_pdf", "princeton offense coaching system", "book"],
  ["playbook_pdf", "basketball offense playbook", "home"],
  ["guide", "princeton offense", "princeton-offense-complete-guide"],
  ["guide", "what is the princeton offense", "princeton-offense-complete-guide"],
  ["guide", "princeton basketball offense", "princeton-offense-complete-guide"],
  ["guide", "princeton offense rules", "princeton-offense-rules"],
  ["guide", "princeton offense reads", "princeton-offense-rules"],
  ["install", "how to run the princeton offense", "how-to-run-the-princeton-offense"],
  ["install", "princeton offense install plan", "princeton-offense-install-plan-first-10-practices"],
  ["install", "install princeton offense", "princeton-offense-install-plan-first-10-practices"],
  ["install", "princeton offense installation checklist", "princeton-offense-installation-checklist"],
  ["plays", "princeton offense plays", "princeton-offense-plays"],
  ["plays", "princeton offense diagrams", "princeton-offense-diagrams"],
  ["plays", "princeton basketball plays", "princeton-offense-plays"],
  ["plays", "chin set basketball", "chin-set"],
  ["drills", "princeton offense drills", "princeton-offense-drills"],
  ["drills", "princeton offense practice drills", "princeton-offense-practice-drills-by-skill-level"],
  ["drills", "backdoor cut drills", "backdoor-cut-basketball-drill"],
  ["high_school", "princeton offense for high school", "princeton-offense-high-school"],
  ["zone", "princeton offense against zone", "princeton-offense-against-zone-defense"],
  ["zone", "princeton offense vs 2-3 zone", "princeton-offense-vs-2-3-zone"],
  ["man", "princeton offense against man defense", "princeton-offense-against-man-to-man"],
  ["comparison", "princeton offense vs motion offense", "princeton-offense-vs-motion-offense"],
  ["comparison", "princeton offense vs flex offense", "princeton-offense-vs-flex-offense"],
  ["comparison", "princeton offense vs dribble drive", "dribble-drive-offense-basketball"],
  ["comparison", "princeton offense vs read and react", "read-and-react-offense-basketball"],
  ["player_fit", "best players for princeton offense", "best-players-for-princeton-offense"]
];

while (seedKeywords.length < 75) {
  const base = seedKeywords[seedKeywords.length % 30];
  seedKeywords.push([base[0], `${base[1]} for coaches`, base[2]]);
}

write(
  "docs/seo/seed-keywords.csv",
  "cluster,keyword,target_slug\n" + seedKeywords.map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n") + "\n"
);

write(
  "docs/seo/90-day-seo-execution.md",
  `# 90-Day SEO Execution Tracker

Last updated: ${today}

## Measurement

- Verify Google Search Console property for https://coachprincetonbasketball.com/.
- Submit https://coachprincetonbasketball.com/sitemap.xml after deployment.
- Track the 75 seed keywords in \`docs/seo/seed-keywords.csv\`.
- Review impressions, CTR, and average position weekly.

## Publishing Cadence

- Publish or substantially update 8-12 pages per month.
- Each new page must link to \`/book/\`, one pillar page, and at least two supporting pages.
- Each major guide must include a direct answer block, visible coaching value, and matching JSON-LD where applicable.

## First Release Included

- Updated core page titles and meta descriptions.
- Added answer blocks to the complete guide, install, plays, drills, and Chin pages.
- Added schema enhancements to the complete guide, install, drills, and book pages.
- Published eight new topical authority articles.
- Added new blog directory cards and sitemap entries.
`
);

console.log(`SEO release implemented: ${articles.length} new articles, core metadata, schema, sitemap, redirects, and keyword tracker.`);
