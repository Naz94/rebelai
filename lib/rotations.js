// ============================================================
// REBEL ENGINE — Content Rotations (lib/rotations.js)
//
// Positioning: Infrastructure Architecture Practice.
// "Most websites are built for launch day. We build for year five."
//
// Content split (enforced via BASE_WEIGHTS):
//   ~40% Web Dev Craft     (value_react, value_perf, value_css, value_debug, value_micro_lesson, value_hot_take)
//   ~25% Infrastructure    (value_systems, value_contrarian, value_rulebook, value_system_breakdown)
//   ~15% Automation & AI   (value_automation)
//   ~10% SA Tech Context   (value_sa_context)
//   ~05% Founder / Builder (value_builder)
//   ── Lab rotations: 30% of total ──
//   lab_tool, lab_infrastructure
//
// Each rotation includes:
//   angles[]     — injected pre-generation to prevent repetitive framing
//   hookStyles[] — injected to vary opening structure
//   copyPrompt   — full generation brief
//   imagePrompt  — visual direction for DALL-E
//
// Visual palette: #FFFFFF white · #080808 near-black · #FF2D2D red
// ============================================================

// ─────────────────────────────────────────────────────────────
// ANGLE + HOOK INJECTION HELPERS
// Called in generate.js before building the user prompt.
// ─────────────────────────────────────────────────────────────

export function pickAngle(rotation, postHistory = []) {
  const angles = rotation.angles ?? DEFAULT_ANGLES;

  // ── Angle cooldown — avoid repeating angles used in the last 10 posts ──
  // postHistory records include an `angle` field when saved via publish.js.
  // Any angle used twice in the last 10 is de-weighted to 1 slot.
  // Angles not used recently get 5 slots (equal probability among fresh options).
  const recentAngles = postHistory
    .slice(-10)
    .map(p => p.angle)
    .filter(Boolean);

  const usedCount = {};
  for (const a of recentAngles) {
    usedCount[a] = (usedCount[a] ?? 0) + 1;
  }

  const pool = [];
  for (const angle of angles) {
    const timesUsed = usedCount[angle] ?? 0;
    const slots     = timesUsed >= 2 ? 1 : 5;  // used twice recently → 1 slot; fresh → 5 slots
    for (let i = 0; i < slots; i++) pool.push(angle);
  }

  return pool[Math.floor(Math.random() * pool.length)];
}

export function pickHookStyle(rotation, hookWeights = {}) {
  const styles = rotation.hookStyles ?? DEFAULT_HOOK_STYLES;

  // If no weight data yet, pick uniformly at random
  if (!hookWeights || Object.keys(hookWeights).length === 0) {
    return styles[Math.floor(Math.random() * styles.length)];
  }

  // Build a weighted pool biased toward higher-performing hook styles.
  // Styles not yet in hookWeights fall back to weight 50.
  const pool = [];
  for (const style of styles) {
    const w     = hookWeights[style] ?? 50;
    const slots = Math.max(1, Math.round(w / 10));   // 50 → 5 slots, 95 → 10, 30 → 3
    for (let i = 0; i < slots; i++) pool.push(style);
  }

  return pool[Math.floor(Math.random() * pool.length)];
}

const DEFAULT_ANGLES = [
  "Contrarian insight",
  "Hidden cost",
  "Architectural trade-off",
  "Common mistake",
  "Mental model",
  "Scaling failure",
  "Senior engineer rule of thumb",
];

const DEFAULT_HOOK_STYLES = [
  "Hard truth",
  "Contrarian take",
  "Technical insight",
  "Hidden system failure",
  "Pattern recognition",
  "Myth correction",
];

// ─────────────────────────────────────────────────────────────
// ROTATIONS
// ─────────────────────────────────────────────────────────────

export const ROTATIONS = [

  // ── WEB DEV CRAFT: React / Next.js ───────────────────────
  {
    id: "value_react",
    name: "React Architecture",
    type: "value",
    category: "webdev",
    description: "Deep-dive React/Next.js patterns, trade-offs, and architectural decisions",

    angles: [
      "The wrong Server/Client Component boundary is the most common Next.js performance mistake",
      "useState is overused — and the architectural reason why matters",
      "Most tutorial App Router implementations have a structural flaw",
      "Re-render cost is misunderstood because component trees are misunderstood",
      "Suspense boundaries are a UX architecture decision, not just a loading state",
      "TypeScript in React is often noise, not safety — here is the difference",
      "useEffect is the most abused hook and the reason is architectural, not syntactic",
    ],

    hookStyles: [
      "Hard truth",
      "Contrarian take",
      "Technical insight",
      "Hidden system failure",
      "Pattern recognition",
      "Myth correction",
    ],

    copyPrompt: `Write a Pure Value social media post (Web Dev Craft category) about a React or Next.js architectural decision, pattern, or modern shift.

Topics to draw from (rotate through, never repeat the same angle):
- Server Components vs Client Components: when the boundary matters and why getting it wrong kills performance
- Why useState is often the wrong tool and what to reach for instead
- App Router patterns that most tutorials get wrong
- The real cost of re-renders and how to think about component trees
- Data fetching patterns: fetch in server components, SWR, React Query — picking the right one
- Why most Next.js apps are slower than they should be
- Suspense boundaries done right: loading states that don't destroy UX
- TypeScript patterns that make React code safer, not just noisier
- Why most developers reach for useEffect when they should not

Rules:
- The angle and hook style will be provided — use them to frame the opening and structure
- Explain the WHY behind the decision, not just the what
- Reference a specific real-world scenario or mistake
- Be opinionated. Senior engineers have positions. Take one.
- Apply the depth rule: one specific mechanism, trade-off, or architectural insight
- Apply the saveable insight rule: one idea worth screenshotting
- Do NOT include a link or CTA
- End with a specific discussion trigger question`,

    imagePrompt: `Editorial technical diagram on pure black (#080808). A clean, precise React component tree or data flow diagram rendered in white (#FFFFFF) hairlines and geometric shapes. Style: between an Apple WWDC architecture slide and a Wired magazine spread. Ultra-thin lines, generous spacing, clinical precision. One node or path highlighted in red (#FF2D2D) — the critical decision point. No gradients, no textures, no decoration. Square 1:1 format. Photorealistic print quality.`,
  },

  // ── WEB DEV CRAFT: Performance Engineering ────────────────
  {
    id: "value_perf",
    name: "Performance Engineering",
    type: "value",
    category: "webdev",
    description: "Core Web Vitals, loading patterns, edge caching, real performance trade-offs",

    angles: [
      "LCP is misunderstood — the real bottleneck is rarely what most tutorials target",
      "Lazy loading above the fold actively destroys the metric it is supposed to help",
      "Edge caching is overused in the wrong places and underused where it matters",
      "JavaScript bundle size is a symptom — the disease is dependency architecture",
      "Font loading is the performance problem nobody prioritises and everybody has",
      "SSR vs SSG vs ISR vs PPR: most developers pick the wrong one for the wrong reason",
      "INP is the performance metric most developers have not optimised for yet",
      "In the South African market, a 3-second load costs a real user real money",
    ],

    hookStyles: [
      "Hard truth",
      "Contrarian take",
      "Technical insight",
      "Hidden system failure",
      "Pattern recognition",
      "Myth correction",
    ],

    copyPrompt: `Write a Pure Value social media post (Web Dev Craft category) about web performance engineering.

Topics to draw from (rotate through, never repeat the same angle):
- LCP: what actually moves the needle and what is cargo-culted advice
- Why lazy loading images above the fold destroys LCP despite feeling right
- Edge caching: what to cache, what not to, and the stale-while-revalidate pattern
- JavaScript bundle analysis: finding what is actually killing TTI
- Font loading: font-display, preload, subsetting, variable fonts
- The real difference between SSR, SSG, ISR, and PPR — when each one wins
- South African context: performance matters more when mobile data is expensive
- INP: the metric most developers have not optimised for yet
- Why a slow website is a credibility failure, not just a UX failure

Rules:
- The angle and hook style will be provided — use them to frame the opening and structure
- Be specific. Real numbers, real trade-offs. Not vague advice.
- Explain the mechanism — why does this cause the problem?
- Apply the depth rule: one specific mechanism or trade-off with actual detail
- Apply the saveable insight rule: one practical rule of thumb
- Be opinionated. Take a position.
- Do NOT include a link or CTA
- End with a specific discussion trigger question`,

    imagePrompt: `Dark premium data visualisation on pure black (#080808). A minimal performance waterfall or Lighthouse score breakdown rendered in clean white (#FFFFFF) lines and bars — like a stripped-down DevTools screenshot reimagined as editorial art. One bar or metric highlighted in red (#FF2D2D). Clinical, precise, no decoration. Square 1:1 format.`,
  },

  // ── WEB DEV CRAFT: Modern CSS ─────────────────────────────
  {
    id: "value_css",
    name: "Modern CSS & Design Systems",
    type: "value",
    category: "webdev",
    description: "CSS architecture, design tokens, layout craft, modern techniques",

    angles: [
      "Container queries unlock something media queries fundamentally cannot — here is the architecture reason",
      "CSS custom properties as a token system is underused and the alternative is painful",
      "Most design systems break at the component API layer, not the visual layer",
      "The Grid vs Flexbox decision has a correct answer most developers never articulate",
      "Cascade layers make large CSS codebases manageable — and almost nobody uses them",
      "The :has() selector changes how component state is modelled in CSS",
      "Tailwind at scale creates specific, predictable technical debt — here is exactly what it looks like",
    ],

    hookStyles: [
      "Hard truth",
      "Contrarian take",
      "Technical insight",
      "Hidden system failure",
      "Pattern recognition",
      "Myth correction",
    ],

    copyPrompt: `Write a Pure Value social media post (Web Dev Craft category) about modern CSS or design system architecture.

Topics to draw from (rotate through, never repeat the same angle):
- Container queries: what they unlock that media queries cannot
- CSS custom properties as a design token system, not just theme variables
- Why most design systems break at the component API layer
- Grid vs Flexbox: the real decision framework
- Cascade layers (@layer): the feature that makes large CSS codebases manageable
- The :has() selector: changes how component state is modelled
- CSS animations that respect prefers-reduced-motion without gutting UX
- Why Tailwind utility-first creates specific technical debt at scale

Rules:
- The angle and hook style will be provided — use them to frame the opening and structure
- Show the architectural thinking, not just the syntax
- Explain what breaks when you get this wrong
- Apply the depth rule: one concrete mechanism or architectural consequence
- Apply the saveable insight rule: one rule of thumb or mental model
- Be opinionated. Take a position on contested topics.
- Do NOT include a link or CTA
- End with a specific discussion trigger question`,

    imagePrompt: `Ultra-clean CSS layout diagram on pure black (#080808). Abstract grid or flexbox visualisation — geometric shapes, white (#FFFFFF) hairlines, generous whitespace. The kind of diagram in a CSS specification document, redesigned by a Bauhaus typographer. One element highlighted in red (#FF2D2D). No gradients. No decoration. Square 1:1 format.`,
  },

  // ── WEB DEV CRAFT: Debug in Public ────────────────────────
  {
    id: "value_debug",
    name: "Debug in Public",
    type: "value",
    category: "webdev",
    description: "Real pain points solved — state management, accessibility, architecture mistakes",

    angles: [
      "Context as state management becomes a performance problem at a very specific threshold",
      "Hydration mismatch errors have three root causes — most developers only know one",
      "ARIA mistakes that hurt real screen reader users look nothing like compliance failures",
      "The wrong Next.js abstraction choice (route vs Server Action) compounds over time",
      "Stacking context failures are never about z-index values — they are about model understanding",
      "useEffect race conditions are a React mental model problem, not a timing problem",
      "Debugging takes 3x longer than it should because the wrong mental model is applied first",
    ],

    hookStyles: [
      "Hard truth",
      "Hidden system failure",
      "Pattern recognition",
      "Myth correction",
      "Technical insight",
    ],

    copyPrompt: `Write a Pure Value social media post (Web Dev Craft category) that debugs in public — takes a common developer pain point and solves it with a specific, actionable insight.

Pain points to draw from (rotate through, never repeat):
- State management hell: when Context becomes a performance problem and what to reach for
- Hydration mismatch errors: why they happen and the three patterns that prevent them
- ARIA mistakes that actually hurt screen reader users (not compliance theatre)
- API route vs Server Action: when developers reach for the wrong abstraction in Next.js
- The z-index wars: why stacking contexts are misunderstood
- Race conditions in async React: the useEffect cleanup pattern most tutorials skip
- Why most debugging takes 3x longer than it should (the wrong mental model problem)

Rules:
- The angle and hook style will be provided — use them to frame the opening
- Structure: name the pain, explain the root cause, give the fix
- Be specific. Name the actual mechanism, not just the symptom.
- Apply the depth rule: explain exactly why this happens at the system level
- Apply the saveable insight rule: the fix should be a rule the reader keeps
- Do NOT include a link or CTA
- End with a specific discussion trigger: "What is the nastiest bug you have had to track down?" or similar`,

    imagePrompt: `Dark premium dev console aesthetic on pure black (#080808). A minimal terminal or error output — clean white (#FFFFFF) monospace text fragments, stack trace lines, status codes — arranged with editorial precision. Not a real screenshot: an abstraction of one. One line or element in red (#FF2D2D) — the error. Square 1:1 format.`,
  },

  // ── WEB DEV CRAFT: Micro Lesson ───────────────────────────
  {
    id: "value_micro_lesson",
    name: "Micro Lesson",
    type: "value",
    category: "webdev",
    description: "Fast developer lessons that teach one sharp, saveable idea in under 20 seconds",

    angles: [
      "The fastest way to reduce JavaScript bundle size without touching the framework",
      "One CSS rule that eliminates an entire class of layout bugs",
      "The most reliable way to prevent hydration mismatches in Next.js",
      "The simplest performance rule most developers ignore",
      "A debugging shortcut that cuts investigation time in half",
      "A mental model for deciding between server and client rendering",
      "One architectural decision that prevents most state management problems",
    ],

    hookStyles: [
      "Technical insight",
      "Pattern recognition",
      "Hard truth",
      "Myth correction",
    ],

    copyPrompt: `Write a Pure Value social media post (Micro Lesson category) that teaches ONE extremely practical developer lesson. This post must be highly saveable — the reader should want to screenshot it.

Structure:
- Strong hook that frames the problem or rule
- Explain the problem briefly
- State the rule of thumb or fix clearly
- Explain WHY the rule works (the mechanism, not just the result)

Topics to draw from (never repeat the same angle):
- A rule that reduces JavaScript bundle weight without changing the framework
- A CSS rule that eliminates a whole category of layout bugs
- The correct mental model for Server vs Client Component boundaries
- A pattern that prevents hydration mismatches before they happen
- A debugging approach that cuts investigation time significantly
- One architectural decision that prevents most state management problems
- The simplest performance improvement most projects skip

Rules:
- The angle and hook style will be provided — use them
- The rule must be something a developer can apply in their next project
- Apply the depth rule: explain the mechanism, not just the outcome
- Apply the saveable insight rule: this post IS the saveable insight — make it sharp
- Must feel like a flashcard worth keeping
- Do NOT include a link or CTA
- End with a specific discussion trigger question`,

    imagePrompt: `Dark editorial flashcard aesthetic on pure black (#080808). A minimal typographic layout — a short rule or principle in clean white (#FFFFFF) monospace or sans-serif type, arranged with precision. Like a programming cheat sheet reimagined as gallery art. One red (#FF2D2D) highlight on the key term. No gradients, no decoration. Square 1:1 format.`,
  },

  // ── WEB DEV CRAFT: Hot Take ───────────────────────────────
  {
    id: "value_hot_take",
    name: "Hot Take",
    type: "value",
    category: "webdev",
    description: "Short contrarian developer opinions that trigger debate and discussion",

    angles: [
      "Tailwind is great for speed but creates predictable technical debt at scale",
      "Framework choice matters less than almost every developer thinks",
      "Most startups should not build a mobile app — they should build a better mobile web experience",
      "Server components will reshape frontend architecture more than any framework has in a decade",
      "AI tools will expose weak developers faster than they replace them",
      "Most 'fullstack' developers are actually frontend developers with one API route",
      "TypeScript without discipline is just JavaScript with extra steps",
    ],

    hookStyles: [
      "Contrarian take",
      "Hard truth",
      "Myth correction",
      "Pattern recognition",
    ],

    copyPrompt: `Write a Pure Value social media post (Hot Take category) presenting a strong, defensible contrarian opinion about web development or software engineering. This post should trigger developer debate in the comments.

Structure:
- Hook: the controversial statement, stated directly and confidently
- Explain the reasoning behind it — where does the common belief come from?
- Show exactly where and how the common belief breaks under real conditions
- Offer the correct or more nuanced perspective

Strong hot take topics:
- Tailwind is excellent for speed, terrible for long-term CSS architecture
- Framework choice is the most overrated decision in frontend engineering
- Most startups should not build mobile apps
- Server components are the biggest architectural shift in years
- AI tools expose weak engineers faster than they replace anyone
- Most "fullstack" devs are just frontend devs who can write one API route
- TypeScript without code discipline adds complexity, not safety

Rules:
- The angle and hook style will be provided — use them
- The opinion must be technically defensible — not contrarian for its own sake
- Apply the depth rule: explain the mechanism behind the failure or the reason the take is correct
- Apply the saveable insight rule: the reasoning should feel worth keeping
- Be direct and confident — do not hedge
- Do NOT include a link or CTA
- End with a question that specifically invites people to agree, push back, or share their experience`,

    imagePrompt: `Dark editorial typography poster on pure black (#080808). A single bold statement in clean white (#FFFFFF) type — typographically precise, slightly oversized, like a printed manifesto detail. One red (#FF2D2D) underline or accent mark beneath the key phrase. No decoration, no gradients, no imagery. Pure typographic tension. Square 1:1 format.`,
  },

  // ── INFRASTRUCTURE & SYSTEMS ──────────────────────────────
  {
    id: "value_systems",
    name: "Infrastructure & Systems Thinking",
    type: "value",
    category: "infrastructure",
    description: "Digital infrastructure, systems design, scalability, tools vs systems mindset",

    angles: [
      "Launch day vs year five: the architectural decisions made on day one determine what breaks on day 1825",
      "Businesses buy tools. Systems thinkers design infrastructure. The outcomes diverge fast.",
      "Digital infrastructure is invisible until it fails — and by then it is expensive",
      "Manual processes do not scale. The bottleneck is not effort, it is architecture.",
      "Multi-tenancy is about building once and scaling horizontally — most systems do the opposite",
      "Most website problems are infrastructure problems that were misdiagnosed",
      "The compounding cost of architectural shortcuts is not visible at launch. It is visible at year two.",
    ],

    hookStyles: [
      "Hard truth",
      "Contrarian take",
      "Pattern recognition",
      "Hidden cost",
      "Myth correction",
    ],

    copyPrompt: `Write a Pure Value social media post (Infrastructure & Systems category) about systems thinking, digital infrastructure, or the difference between building for launch day vs building for scale.

Topics to draw from (rotate through, never repeat the same angle):
- Launch day vs year five: built to impress on day one, not to function on day 1825
- Systems vs tools: businesses buy tools and wonder why nothing connects
- What digital infrastructure actually means — and why most businesses don't have it
- Why growing companies hit a wall: the point where manual processes become the bottleneck
- The invisible systems that run every serious business
- Multi-tenancy: building for one at a time is the most expensive way to scale
- Why most website problems are actually infrastructure problems misdiagnosed
- Contrarian: most businesses don't need a new website. They need better infrastructure.
- The difference between a website and a system at scale
- The compounding cost of architectural shortcuts

Rules:
- The angle and hook style will be provided — use them to frame the opening and structure
- Speak to founders and operators as well as developers
- Use plain language where needed, but never dumb down the insight
- Apply the depth rule: one concrete mechanism or real-world consequence
- Apply the saveable insight rule: one principle, mental model, or rule of thumb
- Be contrarian where the technical position supports it
- Do NOT include a link or CTA
- End with a specific discussion trigger question`,

    imagePrompt: `Dark editorial systems diagram on pure black (#080808). A clean infrastructure architecture map — interconnected nodes, service layers, data flows — rendered in precise white (#FFFFFF) lines. Minimal, clinical, like a blueprint stripped to its essential geometry. One node or connection highlighted in red (#FF2D2D). No gradients. No decoration. Square 1:1 format. Print-quality precision.`,
  },

  // ── CONTRARIAN INSIGHTS ───────────────────────────────────
  {
    id: "value_contrarian",
    name: "Contrarian Insight",
    type: "value",
    category: "infrastructure",
    description: "Challenges common beliefs about web development, business, and infrastructure",

    angles: [
      "Most businesses think they need a new website. What they actually need is better infrastructure.",
      "Most startups build the wrong MVP because they optimise for features instead of architecture",
      "Design systems fail at scale not because of CSS, but because of component API design",
      "AI tools are creating operational chaos in businesses that had stable manual workflows",
      "Framework choice rarely matters. Architecture choice determines everything.",
      "The cheapest developer is rarely the cheapest project. The math always appears later.",
      "Most digital transformation projects fail because they digitise broken processes instead of redesigning them",
    ],

    hookStyles: [
      "Contrarian take",
      "Hard truth",
      "Myth correction",
      "Pattern recognition",
    ],

    copyPrompt: `Write a Pure Value social media post (Contrarian Insight category) that challenges a common belief about web development, business infrastructure, or digital systems.

The post should:
- Start with a statement that contradicts the conventional wisdom
- Explain the more accurate position with a specific technical or business reason
- Show the consequence of the common belief (what goes wrong when people act on it)
- Make the reader feel they now understand something they previously got wrong

Strong contrarian topics:
- Most businesses don't need a new website — they need better infrastructure
- Framework choice is overrated. Architecture is underrated.
- The cheapest build is almost always the most expensive long-term
- Design systems fail at the API layer, not the visual layer
- AI without structure produces chaos at scale
- DIY website builders create lock-in, not freedom
- Manual processes feel faster until they become the bottleneck
- Most "website problems" are infrastructure problems wearing a UX mask

Rules:
- The angle and hook style will be provided — use them
- The opening must be a direct challenge to a belief the reader probably holds
- Apply the depth rule: explain the mechanism behind the failure, not just the conclusion
- Apply the saveable insight rule: the post should feel like a perspective shift
- Be direct and confident
- Do NOT include a link or CTA
- End with a specific discussion trigger that invites the reader to share where they have seen this pattern`,

    imagePrompt: `Dark editorial statement poster on pure black (#080808). Clean white (#FFFFFF) bold typography fragment — a single short phrase or concept — arranged with typographic precision. Like an art direction piece from a premium agency. One red (#FF2D2D) accent element. No gradients, no decoration, no realistic imagery. Pure typographic editorial. Square 1:1 format.`,
  },

  // ── ENGINEERING RULEBOOK ──────────────────────────────────
  {
    id: "value_rulebook",
    name: "Engineering Rulebook",
    type: "value",
    category: "infrastructure",
    description: "Short engineering laws and principles learned from building real systems — highly shareable",

    angles: [
      "Every system eventually becomes infrastructure whether it was designed to be or not",
      "Manual processes are technical debt wearing an operational disguise",
      "If scaling breaks the system, the architecture was wrong before the first user arrived",
      "Every automation starts as a repeated human task that someone got tired of",
      "A system without observability is a system that will fail silently",
      "Performance problems are almost always architecture problems diagnosed too late",
      "Complexity does not appear. It accumulates. Usually without anyone noticing.",
    ],

    hookStyles: [
      "Hard truth",
      "Contrarian take",
      "Pattern recognition",
    ],

    copyPrompt: `Write a Pure Value social media post (Engineering Rulebook category) presenting a single engineering rule or law learned from building real systems. This post should be highly shareable — the kind of thing engineers forward to their teams.

Structure:
- Hook: state the rule directly and memorably
- Explanation: why this rule exists
- Scenario: where and how this breaks when the rule is ignored
- Architectural lesson: the underlying principle

Engineering rules to draw from (rotate through, never repeat):
- Every system eventually becomes infrastructure
- Manual processes are technical debt in disguise
- If scaling breaks it, the architecture was wrong at the start
- Every automation begins as a repeated human task
- A system with no observability will fail silently
- Performance problems are almost always architecture problems
- Complexity accumulates without anyone deciding to add it
- The most expensive part of any system is the part nobody thought would scale
- Simple systems outlive complex ones built for the same purpose

Rules:
- The angle and hook style will be provided — use them
- The rule must be short, memorable, and feel like something a senior engineer would tattoo on a wall
- Apply the depth rule: explain the mechanism — why is this rule true?
- Apply the saveable insight rule: the rule itself is the saveable insight — make it land
- Do NOT include a link or CTA
- End with a specific discussion trigger question`,

    imagePrompt: `Dark editorial manifesto aesthetic on pure black (#080808). A single engineering principle rendered in precise white (#FFFFFF) type — like a printed rule from an internal style guide, elevated to gallery quality. Generous negative space. One red (#FF2D2D) accent mark. No decoration, no gradients. Square 1:1 format. Print quality.`,
  },

  // ── SYSTEM BREAKDOWN ─────────────────────────────────────
  {
    id: "value_system_breakdown",
    name: "System Breakdown",
    type: "value",
    category: "infrastructure",
    description: "Explaining the infrastructure behind real digital systems most people use without understanding",

    angles: [
      "Why WhatsApp became the default commerce infrastructure layer in South Africa",
      "Why Shopify scaled while most e-commerce platforms didn't — it is an infrastructure story",
      "Why Stripe succeeded by solving infrastructure problems, not payment problems",
      "The infrastructure behind modern social commerce that most founders never see",
      "Why most SaaS platforms fail at multi-tenancy — and the architectural reason",
      "How Vercel Edge changed deployment architecture at a fundamental level",
      "Why mobile-first is an infrastructure decision, not a design decision",
    ],

    hookStyles: [
      "Pattern recognition",
      "Technical insight",
      "Contrarian take",
      "Hard truth",
    ],

    copyPrompt: `Write a Pure Value social media post (System Breakdown category) that explains the infrastructure behind a well-known digital system. Reveal something the reader uses every day but doesn't understand at the infrastructure level.

Topics to draw from (rotate through, never repeat the same angle):
- Why WhatsApp is a commerce infrastructure layer for millions of South African businesses
- Why Shopify scaled: it is an infrastructure story, not a product story
- Why Stripe succeeded by solving infrastructure problems, not payment problems
- The infrastructure behind social commerce that founders never see
- Why most SaaS platforms fail at multi-tenancy
- Why Vercel Edge changed deployment architecture
- Why mobile-first is an infrastructure decision, not a design preference
- Why most "simple" consumer apps have deeply complex infrastructure underneath

Rules:
- The angle and hook style will be provided — use them
- Lead with the surprising infrastructure insight — reveal something the reader didn't know
- Explain the architectural decision that made the system work (or fail)
- Apply the depth rule: one concrete infrastructure insight the reader can learn from
- Apply the saveable insight rule: the lesson should apply beyond the specific example
- End with a specific discussion trigger question that invites the reader to share similar system insights`,

    imagePrompt: `Dark editorial infrastructure explainer on pure black (#080808). A clean system breakdown diagram — layered architecture, service components, data flows — rendered in precise white (#FFFFFF) technical lines. Like the inside of a well-known product, stripped to its engineering skeleton. One component highlighted in red (#FF2D2D) — the critical infrastructure layer. No gradients, no decoration. Square 1:1 format.`,
  },

  // ── AUTOMATION & AI ───────────────────────────────────────
  {
    id: "value_automation",
    name: "Automation & AI Systems",
    type: "value",
    category: "automation",
    description: "AI agents, automation pipelines, structured workflows — AI as infrastructure",

    angles: [
      "AI is not magic. It is infrastructure with inputs, outputs, and failure modes like everything else.",
      "The automation threshold: any task repeated every week is not a task, it is a broken process",
      "AI agents and chatbots are architecturally different. Most people use the wrong one.",
      "Most AI implementations fail because the team treated it as a product, not infrastructure",
      "Garbage in, garbage out applies to AI at a scale most teams do not anticipate",
      "What a production AI agent actually requires is unglamorous and rarely covered",
      "Automation removes repetitive work. It does not remove the need for architecture.",
      "Consistent brand presence at scale requires systems. Reactive posting is not a strategy.",
    ],

    hookStyles: [
      "Myth correction",
      "Hard truth",
      "Technical insight",
      "Pattern recognition",
      "Contrarian take",
    ],

    copyPrompt: `Write a Pure Value social media post (Automation & AI category) about automation thinking, AI systems, or the infrastructure behind intelligent workflows.

Topics to draw from (rotate through, never repeat the same angle):
- AI is infrastructure — structured inputs, defined outputs, controlled environments
- The automation threshold: repeated tasks should be systems, not tasks
- How AI agents actually work: structured pipelines, not intelligence
- Why most AI implementations fail: treating AI as product instead of infrastructure
- The difference between a chatbot and an AI agent — architectural
- What production AI agents actually require (the unglamorous parts)
- Automation removes repetitive tasks. It does not replace thinking.
- Why AI without structure produces inconsistent output at scale
- How automated content systems maintain consistent brand presence
- South African business context: why automation matters more when operational costs are high

Rules:
- The angle and hook style will be provided — use them
- Position AI as infrastructure, not magic or hype
- Be specific about how systems are structured — inputs, outputs, logic, failure modes
- Apply the depth rule: one concrete mechanism or architectural insight
- Apply the saveable insight rule: one principle a founder or developer will keep
- Speak to founders and operators as well as developers
- Do NOT include a link or CTA
- End with a specific discussion trigger question`,

    imagePrompt: `Dark premium automation pipeline diagram on pure black (#080808). A clean agent workflow — decision nodes, data flows, trigger points — rendered in white (#FFFFFF) precision lines. Like a circuit board reimagined as editorial art. One node highlighted in red (#FF2D2D) — the automation trigger. Clinical, minimal, no decoration. Square 1:1 format.`,
  },

  // ── SA TECH CONTEXT ───────────────────────────────────────
  {
    id: "value_sa_context",
    name: "SA Tech Context",
    type: "value",
    category: "sa_context",
    description: "Infrastructure realities specific to South Africa and Africa — data costs, mobile-first, payment systems, local market",

    angles: [
      "A 3-second page load in South Africa costs the user real money. That changes the UX calculus.",
      "Mobile-first in Africa means designing for constrained connectivity, not just small screens",
      "WhatsApp is not just a messaging app in South Africa — it is a commerce infrastructure layer",
      "Most Western SaaS assumptions break on the African internet. Here is exactly where.",
      "Paystack and Yoco exist because Stripe did not understand the local payment infrastructure",
      "The data cost argument for performance is more compelling in SA than any Lighthouse score",
      "Building for intermittent connectivity is a system design problem, not a frontend problem",
    ],

    hookStyles: [
      "Hard truth",
      "Technical insight",
      "Pattern recognition",
      "Contrarian take",
      "Hidden cost",
    ],

    copyPrompt: `Write a Pure Value social media post (SA Tech Context category) about the specific infrastructure realities of building digital systems in South Africa or Africa.

Topics to draw from (rotate through, never repeat the same angle):
- Data costs: why performance matters more when mobile data is expensive (R2 per MB context)
- Mobile-first design in Africa: constrained connectivity, not just small screens
- WhatsApp as commerce infrastructure: why it functions as a transaction layer for millions of South African businesses
- Western SaaS assumptions that break in African markets: payment flows, connectivity, device specs
- Local payment infrastructure: Paystack, Yoco, and why they exist instead of Stripe
- Designing for intermittent connectivity: offline-first patterns and resilient state management
- Why South African developers building for local users must think differently about performance budgets

Rules:
- The angle and hook style will be provided — use them
- Ground every post in a real, specific local context — not generic "Africa" generalisations
- Do NOT reference load shedding — this is no longer a current infrastructure narrative
- Apply the depth rule: one specific mechanism, real number, or architectural consequence
- Apply the saveable insight rule: one principle that changes how a local developer or founder approaches a problem
- Speak to both local developers and international developers thinking about African markets
- Do NOT include a link or CTA
- End with a specific discussion trigger question`,

    imagePrompt: `Dark editorial infrastructure map aesthetic on pure black (#080808). A minimal connectivity or network diagram suggesting geographic scale — signal nodes, data paths, coverage layers — rendered in precise white (#FFFFFF) hairlines. Clinical, editorial, like a telco infrastructure diagram reimagined as gallery art. One node highlighted in red (#FF2D2D). No gradients. No decoration. Square 1:1 format.`,
  },

  // ── FOUNDER / BUILDER ─────────────────────────────────────
  {
    id: "value_builder",
    name: "Founder & Builder Perspective",
    type: "value",
    category: "builder",
    description: "Build-in-public, systems mindset, behind-the-scenes of real infrastructure work. First-person allowed.",

    angles: [
      "Building systems instead of chasing trends: what the long game actually requires",
      "What building a production AI agent teaches that no tutorial covers",
      "The gap between working and production-ready is where most projects silently fail",
      "The most valuable systems in any business are invisible to everyone except the team that built them",
      "Iteration and real failure are the only education that transfers to production",
      "Systems compound. Manual work just accumulates.",
      "The mindset shift from building websites to building infrastructure is not incremental. It is structural.",
    ],

    hookStyles: [
      "Hard truth",
      "Pattern recognition",
      "Contrarian take",
      "Hidden cost",
    ],

    copyPrompt: `Write a Pure Value social media post (Founder / Builder category) from the perspective of someone building real infrastructure systems — reflective, direct, human. First-person is allowed in this category.

Topics to draw from (rotate through, never repeat the same angle):
- Building systems instead of chasing trends
- What building a production AI agent teaches
- The gap between "working" and "production-ready"
- Why the most valuable business systems are invisible to customers
- Learning through building: iteration and real failure
- The compounding advantage of infrastructure over manual work
- Build-in-public: honest reflection on what it takes to ship real systems
- The mindset shift from building websites to building infrastructure
- What year five looks like when you built for it on day one

Rules:
- The angle and hook style will be provided — use them
- First-person ("I", "we") is permitted in this category when describing real build experiences
- The post should feel more human and reflective than other categories — but still sharp, not soft
- Short, punchy sentences still apply
- Apply the depth rule: one concrete mechanism or real consequence from actual building
- Apply the saveable insight rule: one principle about how real systems get built
- Do NOT include a link or CTA
- End with a question that invites the reader to reflect on their own approach`,

    imagePrompt: `Dark editorial photograph aesthetic on pure black (#080808). A single focused object — a blueprint, a terminal window, a technical notebook — shot with extreme precision. Negative space dominant. White (#FFFFFF) details, crisp and deliberate. One red (#FF2D2D) accent mark — a highlight, a cursor, a status dot. The mood: a builder at work, focused, late. Square 1:1 format. Photorealistic.`,
  },

  // ── LAB SHOWCASE: Password Roast ─────────────────────────
  {
    id: "lab_tool",
    name: "Lab Tool Showcase",
    type: "lab",
    category: "lab",
    description: "Password Roast as a case study in infrastructure-grade security UX",

    angles: [
      "Client-side only architecture is the correct security decision — and most tools get this wrong",
      "Security UX that is boring is security UX that gets ignored. That is a failure.",
      "A simple tool built properly reveals more about engineering standards than a complex one built quickly",
      "Infrastructure thinking applies at every scale — including a single-purpose browser tool",
    ],

    hookStyles: [
      "Technical insight",
      "Contrarian take",
      "Hard truth",
      "Pattern recognition",
    ],

    copyPrompt: `Write a Lab Showcase post introducing Password Roast as a case study in infrastructure thinking applied to security UX.

Tool details:
- Name: Password Roast
- Live at: passwordroast.netlify.app
- What it does: rates password strength in real time with brutal, witty commentary
- Engineering decisions to highlight:
  - Client-side only architecture — no passwords ever transmitted to a server. Zero. This is the correct security decision.
  - Real-time entropy calculation — not a simple length check. Actual cryptographic strength scoring.
  - UX that makes security feedback non-boring — if security feedback is ignored, it fails regardless of accuracy
  - The architectural principle: good security UX is infrastructure, not decoration

Angles available (pick one, never repeat):
- The security UX problem: most tools tell you a password is weak. Password Roast tells you why, in terms you remember.
- The client-side decision: why sending passwords to a server for strength checking is architecturally wrong
- What a simple tool reveals about engineering standards: the invisible decisions are the ones that matter
- Infrastructure thinking at every scale: the same principles that govern large systems should govern every component

Rules:
- The angle and hook style will be provided — use them
- Lead with the engineering decision, not the product pitch
- Explain WHY it was built this way — what problem does the architectural choice solve?
- Apply the depth rule: one specific mechanism or architectural consequence
- Position the tool as proof that Rebel Designs applies infrastructure thinking at every scale
- Include ONE link: passwordroast.netlify.app
- End with a direct CTA to try it — do NOT end with a question`,

    imagePrompt: `Ultra-premium dark product photography on pure black (#080808). A sleek browser window displaying a minimal security tool interface — clean white (#FFFFFF) UI, crisp monospace feedback text, entropy score visualisation. Studio lighting, single cold white source. Screen glows slightly against the black void. Shot at 15 degrees. One small red (#FF2D2D) indicator dot. Photorealistic, 8K, square 1:1 format.`,
  },

  // ── LAB SHOWCASE: Infrastructure Projects ────────────────
  {
    id: "lab_infrastructure",
    name: "Infrastructure Project Showcase",
    type: "lab",
    category: "lab",
    description: "Rebel Designs projects as proof of the infrastructure approach",

    angles: [
      "Layered forensic analysis is more reliable than single-point detection — always",
      "Multi-tenancy is a horizontal scaling decision, not a feature",
      "Social commerce fails when the infrastructure layer is missing, not when the product is wrong",
      "Consistent brand presence at scale requires a system, not a schedule",
    ],

    hookStyles: [
      "Hard truth",
      "Technical insight",
      "Pattern recognition",
      "Contrarian take",
    ],

    copyPrompt: `Write a Lab Showcase post introducing one of Rebel Designs' live infrastructure projects as a case study in systems thinking.

Projects available (choose one, rotate through, never repeat the same angle):

1. Document Validation Engine
   - What it is: computer vision pipeline for detecting digital tampering in PDF documents
   - Tech: Python, OpenCV, scikit-image, Error Level Analysis (ELA), metadata forensic scanner, pixel heatmap detection
   - Business problem: digitally altered proof-of-payment documents are increasing. Visual inspection alone fails.
   - Infrastructure angle: layered forensic analysis cross-validates visual and metadata signals. No single detection point.
   - URL: rebeldesigns.co.za/Infrastructure

2. Multi-Tenant Commerce Platform
   - What it is: SaaS commerce architecture serving multiple independent storefronts from a unified core
   - Tech: tenant-aware routing, Row-Level Security (RLS), shared auth, modular storefront components
   - Business problem: single-tenant builds duplicate infrastructure cost. Scaling linearly is the wrong architecture.
   - Infrastructure angle: shared-service core with strict tenant isolation. Horizontal scalability without duplication.
   - URL: rebeldesigns.co.za/Infrastructure

3. QuickShap Social-Commerce Dashboard
   - What it is: lightweight transaction bridge between social media engagement and structured order fulfilment
   - Business problem: social sellers on WhatsApp, TikTok, Instagram lose sales to DM chaos. Traditional e-commerce is too heavy.
   - Infrastructure angle: micro-commerce layer optimised for mobile-first sellers. Under 2-minute setup.
   - URL: rebeldesigns.co.za/Infrastructure

4. Autonomous Content Strategy Agent
   - What it is: trend-aware content generation and distribution agent
   - Infrastructure angle: not a chatbot. A structured pipeline — trend analysis, brand voice conditioning, performance feedback loop, weighted rotation system
   - Business problem: consistent brand presence requires systems, not reactive posting
   - URL: rebeldesigns.co.za/Infrastructure

Rules:
- The angle and hook style will be provided — use them
- Lead with the infrastructure problem, not the product description
- Explain the architectural decision — why this approach and not a simpler one?
- Apply the depth rule: one specific technical mechanism from the actual build
- Frame the project as proof that Rebel Designs builds systems, not websites
- Include ONE link: rebeldesigns.co.za/Infrastructure
- End with a direct CTA — do NOT end with a question`,

    imagePrompt: `Dark editorial systems architecture poster on pure black (#080808). A precise infrastructure diagram — layered system components, data flows, isolation boundaries — rendered in clean white (#FFFFFF) technical lines. The aesthetic of a high-end engineering spec sheet reimagined as gallery art. One system layer or node highlighted in red (#FF2D2D). No gradients, no decoration. Square 1:1 format. Print quality.`,
  },

  // ── AI SYSTEMS — Agent Reveals Itself ────────────────────────────────────
  // The most powerful marketing asset is the system itself.
  // These posts explain AI infrastructure architecture and occasionally
  // let the agent step back and describe what it actually is.
  {
    id: "value_ai_systems",
    name: "AI Systems Architecture",
    type: "value",
    category: "ai_systems",
    description: "AI as infrastructure — pipelines, feedback loops, and operational systems",

    angles: [
      "AI tools save time. AI infrastructure removes the work entirely. The difference is architectural.",
      "The agent revealing itself: this post was generated by the system it is describing",
      "Most businesses use AI as a layer on top of manual work. Infrastructure replaces the manual layer.",
      "An AI system without structure is noise. With structure, it becomes operational infrastructure.",
      "The five components every production AI system requires — most implementations skip three of them",
      "Why AI agents and chatbots are architecturally different, and why most businesses deploy the wrong one",
      "Feedback loops are what separate AI experiments from AI infrastructure",
      "Consistent output at scale requires systems. Prompts alone do not scale.",
    ],

    hookStyles: [
      "Hard truth",
      "Technical insight",
      "Myth correction",
      "Pattern recognition",
      "The reveal",
    ],

    copyPrompt: `Write a Pure Value social media post (AI Systems Architecture category) about AI as infrastructure rather than AI as a tool.

Topics to draw from (rotate through, never repeat the same angle):
- AI tools save time. AI infrastructure removes the work. The architectural difference between the two.
- What a production AI agent actually requires: input signals, processing logic, feedback loops, failure handling, monitoring
- Why AI without structure produces inconsistent output at scale
- The difference between a chatbot and an agent — it is architectural, not cosmetic
- How feedback loops turn AI from a tool into a system that improves itself
- Consistent brand presence at scale requires systems, not reactive posting
- Why most AI implementations fail: treating AI as a product rather than infrastructure
- The Autonomous Content Agent: a system that analyses trends, generates platform-specific content, measures engagement, and adjusts strategy — this post is an output of that system
- Multi-tenant AI infrastructure: building once, scaling across businesses

Special case — The Reveal:
If the assigned angle is "The agent revealing itself", write a post that openly states this content was generated by an autonomous AI system, then explains the architecture behind it. Not as marketing. As a technical case study. The system describing itself is the point.

Rules:
- The angle and hook style will be provided — use them
- Position AI as infrastructure, not magic or hype
- Be specific about system architecture — inputs, outputs, logic, feedback loops, failure modes
- Apply the depth rule: one concrete mechanism an engineer would recognise as non-trivial
- Apply the saveable insight rule: one principle a founder or technical lead will keep
- Speak to both developers and founders — the technical insight must translate to business consequence
- Do NOT include a link or CTA
- End with a specific discussion trigger question`,

    imagePrompt: `Dark premium AI pipeline diagram on pure black (#080808). A precise system architecture — input nodes, processing layers, feedback loops, output signals — rendered in clean white (#FFFFFF) precision lines. The aesthetic of a production system diagram, stripped to its essential geometry. Clinical and technical. One loop or connection highlighted in red (#FF2D2D) — the feedback signal. No gradients, no decoration. Square 1:1 format. Print quality.`,
  },
];

// ─────────────────────────────────────────────────────────────
// GET by index (sequential fallback — kept for compatibility)
// ─────────────────────────────────────────────────────────────

export function getRotation(index) {
  return ROTATIONS[index % ROTATIONS.length];
}

// ─────────────────────────────────────────────────────────────
// WEIGHTED SELECTION
//
// Value pool (65–75 slots, randomised) distributed by BASE_WEIGHTS.
// Lab pool (25–35 slots, remainder) split between lab rotations.
//
// BASE_WEIGHTS:
//   value_react:             50  ]
//   value_perf:              50  ] web dev ~40% of value slots
//   value_css:               50  ]
//   value_debug:             50  ]
//   value_micro_lesson:      55  ] saveable + educational
//   value_hot_take:          55  ] discussion + debate
//   value_systems:           60  ] infrastructure/contrarian ~25%
//   value_contrarian:        55  ]
//   value_rulebook:          55  ] shareable engineering rules
//   value_system_breakdown:  50  ] infrastructure explainers
//   value_automation:        45  — automation ~15%
//   value_sa_context:        35  — SA context ~10%
//   value_builder:           25  — founder/builder ~5%
//   value_ai_systems:        50  — AI infrastructure/systems positioning
//   lab_tool:                50  ] lab — equal split
//   lab_infrastructure:      50  ]
// ─────────────────────────────────────────────────────────────

const BASE_WEIGHTS = {
  value_react:             50,
  value_perf:              50,
  value_css:               50,
  value_debug:             50,
  value_micro_lesson:      55,
  value_hot_take:          55,
  value_systems:           60,
  value_contrarian:        55,
  value_rulebook:          55,
  value_system_breakdown:  50,
  value_automation:        45,
  value_sa_context:        35,
  value_builder:           25,
  value_ai_systems:        50,   // AI infrastructure — new service positioning
  lab_tool:                50,
  lab_infrastructure:      50,
};

export function getWeightedRotation(weights = {}) {
  const merged = { ...BASE_WEIGHTS };
  for (const [id, w] of Object.entries(weights)) {
    if (id in merged) merged[id] = w;
  }
  return selectWithSplit(merged);
}

function selectWithSplit(weights) {
  const valueRotations = ROTATIONS.filter(r => r.type === "value");
  const labRotations   = ROTATIONS.filter(r => r.type === "lab");

  // Slight randomness prevents visible posting patterns (65–75 value / 25–35 lab)
  const valueSlots = 65 + Math.floor(Math.random() * 11);
  const labSlots   = 100 - valueSlots;

  const pool = [];

  const totalValueWeight = valueRotations.reduce((s, r) => s + (weights?.[r.id] ?? 50), 0);
  for (const r of valueRotations) {
    const w     = weights?.[r.id] ?? 50;
    const slots = Math.max(1, Math.round((w / totalValueWeight) * valueSlots));
    for (let i = 0; i < slots; i++) pool.push(r);
  }

  const totalLabWeight = labRotations.reduce((s, r) => s + (weights?.[r.id] ?? 50), 0);
  for (const r of labRotations) {
    const w     = weights?.[r.id] ?? 50;
    const slots = Math.max(1, Math.round((w / totalLabWeight) * labSlots));
    for (let i = 0; i < slots; i++) pool.push(r);
  }

  return pool[Math.floor(Math.random() * pool.length)];
}
