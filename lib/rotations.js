// ============================================================
// REBEL ENGINE — Content Rotations (lib/rotations.js)
//
// Audience: SME owners, e-commerce founders, service businesses
// in South Africa. Referral-led. Not technical.
//
// Goal: Build confidence before the call. Make them feel
// "this person knows what they're doing and I can trust them."
//
// Content split (enforced via BASE_WEIGHTS):
//   ~30% Website / Online Presence  (trust_web, trust_ecommerce)
//   ~20% AI & Automation            (ai_whatsapp, ai_social)
//   ~15% Process & Trust            (trust_process, trust_signals)
//   ~10% SA Business Context        (sa_business)
//   ~10% Client Reality             (client_reality)
//   ~05% Founder / Builder          (trust_builder)
//   ── Showcase rotations: 30% of total ──
//   lab_showcase, lab_ai_tools
//
// Each rotation includes:
//   angles[]     — pre-generation injection to vary framing
//   hookStyles[] — varies opening sentence structure
//   copyPrompt   — full generation brief
//   imagePrompt  — visual direction for image generation
// ============================================================

// ─────────────────────────────────────────────────────────────
// ANGLE + HOOK INJECTION HELPERS
// ─────────────────────────────────────────────────────────────

export function pickAngle(rotation, postHistory = []) {
  const angles = rotation.angles ?? DEFAULT_ANGLES;

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
    const slots     = timesUsed >= 2 ? 1 : 5;
    for (let i = 0; i < slots; i++) pool.push(angle);
  }

  return pool[Math.floor(Math.random() * pool.length)];
}

export function pickHookStyle(rotation, hookWeights = {}) {
  const styles = rotation.hookStyles ?? DEFAULT_HOOK_STYLES;

  if (!hookWeights || Object.keys(hookWeights).length === 0) {
    return styles[Math.floor(Math.random() * styles.length)];
  }

  const pool = [];
  for (const style of styles) {
    const w     = hookWeights[style] ?? 50;
    const slots = Math.max(1, Math.round(w / 10));
    for (let i = 0; i < slots; i++) pool.push(style);
  }

  return pool[Math.floor(Math.random() * pool.length)];
}

const DEFAULT_ANGLES = [
  "The hidden cost of settling",
  "What a business owner actually needs",
  "The thing nobody tells you upfront",
  "What good looks like vs what most people get",
  "The decision most businesses get wrong",
];

const DEFAULT_HOOK_STYLES = [
  "Direct truth",
  "Relatable situation",
  "Surprising fact",
  "Contrast: what most people do vs what works",
];

// ─────────────────────────────────────────────────────────────
// ROTATIONS
// ─────────────────────────────────────────────────────────────

export const ROTATIONS = [

  // ── WEBSITE & ONLINE PRESENCE ────────────────────────────
  {
    id: "trust_web",
    name: "Website & Online Presence",
    type: "value",
    category: "website",
    description: "Why a proper website matters — for a business owner audience",

    angles: [
      "A slow website is costing you customers you never knew you lost",
      "Most business owners don't actually own their website",
      "The difference between a template and something built for your business",
      "Why your website is your best or worst salesperson",
      "What happens to your business when your website goes down and you don't know who to call",
      "The website you got three years ago might be costing you sales right now",
      "Why mobile matters more than most developers tell you",
    ],

    hookStyles: [
      "Direct truth",
      "Relatable situation",
      "Surprising fact",
      "Contrast: what most people do vs what works",
    ],

    copyPrompt: `Write a Value social media post for South African business owners about why a proper website matters.

Audience: Restaurant owners, retailers, service businesses, e-commerce sellers. Not technical. Busy. Have been burned before or are starting fresh.

Topics to draw from (rotate through, never repeat the same angle):
- A slow website loses customers before they even see what you sell. Most business owners don't know it's happening.
- Most small business websites are built on templates that weren't designed for the owner's specific business.
- Your website is the first impression most new customers get — it works for you or against you 24/7.
- Not owning your own website (locked in with a freelancer, on someone else's hosting) is a real business risk.
- Mobile phones are how most South African customers find businesses. If your site looks bad on a phone, they leave.
- A website that was fine three years ago might be losing you customers today. The internet moves faster than most people think.
- The difference between a website that converts visitors into customers vs one that just exists.

Rules:
- Plain language only. No technical jargon.
- Speak from experience — direct, confident, warm.
- Focus on their business reality. Their customers. Their risk. Their missed opportunity.
- Do NOT mention competitors or other developers by name.
- Do NOT pitch Rebel Designs directly — this is a value post. Let the expertise do the selling.
- End with a question they can answer from their own experience ("Have you checked your website on a phone lately?" etc.)`,

    imagePrompt: `Clean, warm editorial photograph. A South African business owner — restaurant, retail, or service setting — looking at a laptop or phone with a focused, confident expression. Natural lighting, real environment. No stock-photo feel. Warm tones, authentic. Square 1:1 format.`,
  },

  // ── E-COMMERCE & ONLINE STORES ───────────────────────────
  {
    id: "trust_ecommerce",
    name: "E-Commerce & Online Stores",
    type: "value",
    category: "ecommerce",
    description: "Selling online — what it actually takes for a South African business",

    angles: [
      "Most South African businesses lose sales because checkout is too hard",
      "The difference between a proper online store and one that just looks like one",
      "Why payment integration matters more than the design of your store",
      "What a customer experiences when your online store doesn't work properly",
      "Selling on Instagram vs having your own store — the real difference",
      "Why most small business online stores get abandoned by the person who paid for them",
      "The hidden cost of using someone else's platform to sell your products",
    ],

    hookStyles: [
      "Direct truth",
      "Relatable situation",
      "Surprising fact",
      "Contrast: what most people do vs what works",
    ],

    copyPrompt: `Write a Value social media post for South African business owners who sell products online or want to.

Audience: Retailers, fashion brands, food businesses, anyone selling on Instagram or WhatsApp or thinking about setting up an online store.

Topics to draw from:
- Selling on Instagram DMs or WhatsApp works to a point — but there's a ceiling and it usually hits you at the worst time.
- A proper online store means customers can buy without you being available. Money while you sleep.
- Checkout friction is the biggest reason people abandon an order. One extra step can cost you the sale.
- South African payment options matter — Paystack, Yoco, EFT. If your store doesn't support how your customers want to pay, they won't.
- Owning your store vs renting space on someone else's platform. Platform fees, rule changes, account suspensions — all things that happen to businesses that don't own their infrastructure.
- A store that's hard to manage is a store that stops being updated. Outdated stock, wrong prices, dead links all lose sales silently.

Rules:
- Plain language. Speak to their reality.
- Focus on the consequence of getting it wrong or the benefit of getting it right.
- Relatable, not preachy.
- End with a question they can answer from their own experience.`,

    imagePrompt: `Clean editorial photograph of a South African small business setting — product photography flat lay, a phone showing an online store, or a business owner packing an order. Warm, real, authentic. No stock-photo look. Square 1:1 format.`,
  },

  // ── WHATSAPP AUTOMATION ───────────────────────────────────
  {
    id: "ai_whatsapp",
    name: "WhatsApp Automation",
    type: "value",
    category: "ai",
    description: "WhatsApp chatbots — sell the idea to business owners",

    angles: [
      "Answering the same WhatsApp questions every day is a full-time job that shouldn't exist",
      "What a WhatsApp bot actually does for a business",
      "The customers who message after hours and never hear back",
      "How a WhatsApp bot handles inquiries while you sleep",
      "The business that replies in 10 seconds vs the one that replies the next day",
      "Why most South African businesses are losing leads through their WhatsApp",
      "What it costs to answer every inquiry manually vs what a bot costs",
    ],

    hookStyles: [
      "Relatable situation",
      "Direct truth",
      "Contrast: what most people do vs what works",
      "Surprising fact",
    ],

    copyPrompt: `Write a Value social media post for South African business owners about WhatsApp automation.

Audience: Any business owner who handles customer inquiries on WhatsApp — restaurants, salons, retailers, service businesses. They know the pain of WhatsApp but haven't thought about automating it.

Topics to draw from:
- Most South African businesses lose leads because no one replies to WhatsApp after hours. A bot doesn't sleep.
- Answering "what are your prices?", "are you open?", "do you deliver?" every single day is wasted time that could be automated.
- The speed of the first reply matters more than most business owners think. The business that responds first usually gets the sale.
- A WhatsApp bot can qualify leads, take bookings, send price lists, and handle FAQs — without any human involvement.
- WhatsApp is where South African customers actually are. Most businesses treat it like a chat app. It can be an automated sales channel.
- The difference between a business that handles 50 WhatsApp inquiries a day manually and one that has a bot doing it.

Rules:
- Plain language. Make it feel real and relevant to their daily life.
- The pain point should be recognisable — they should read it and think "that's exactly my problem."
- Don't over-explain how bots work. Focus on what changes for the business owner.
- End with a relatable question ("How much time do you spend on WhatsApp every day?" etc.)`,

    imagePrompt: `Clean, modern graphic on dark background. A WhatsApp conversation interface — minimal, stylised, showing an automated reply coming through instantly. Dark background (#080808), green WhatsApp elements, white text. Professional, not stock. Square 1:1 format.`,
  },

  // ── SOCIAL MEDIA AUTOMATION ──────────────────────────────
  {
    id: "ai_social",
    name: "Social Media Automation",
    type: "value",
    category: "ai",
    description: "Social media agents — sell consistent posting to business owners",

    angles: [
      "Most business owners stop posting because they run out of time, not ideas",
      "What consistent social media posting does for a business over 12 months",
      "The business that posts every week vs the one that posts when they remember",
      "What a social media agent actually does behind the scenes",
      "Why inconsistent posting hurts more than not posting at all",
      "The hidden cost of doing your social media manually",
      "What your competitors are doing while you're trying to write your next caption",
    ],

    hookStyles: [
      "Relatable situation",
      "Direct truth",
      "Contrast: what most people do vs what works",
      "Surprising fact",
    ],

    copyPrompt: `Write a Value social media post for South African business owners about the value of consistent social media and automation.

Audience: Business owners who know they should be posting regularly but don't manage it consistently because they're too busy running their business.

Topics to draw from:
- Most businesses post for a week, then disappear for a month. The algorithm punishes inconsistency. So do potential customers who check your page.
- Consistent social media builds trust over time in a way that nothing else can replicate. Showing up regularly tells customers you're still there, still active, still worth choosing.
- Writing captions, finding images, posting at the right time — it's not one task, it's five tasks. For every post.
- A social media agent handles the content calendar while you handle the business. Posts go out whether or not you remembered to schedule them.
- The business owner who posts three times a week for a year will be unrecognisable compared to the one who posts when they have time.
- Most people think automation means fake content. That's not true. It means consistent content, brand-appropriate, planned and posted without you having to do it.

Rules:
- Speak to the real frustration of being too busy to do social media properly.
- Don't make it feel like a lecture. Empathise with the problem first.
- End with a relatable question about their own social media habits.`,

    imagePrompt: `Clean dark minimal graphic. A content calendar or scheduled posts visual — stylised, editorial. Phone screen showing posts going live automatically. Dark background, clean white elements, one red accent. Modern, confident. Square 1:1 format.`,
  },

  // ── PROCESS & TRUST ───────────────────────────────────────
  {
    id: "trust_process",
    name: "The Process & What to Expect",
    type: "value",
    category: "trust",
    description: "Demystify getting a website built — remove the fear of starting",

    angles: [
      "Most people don't know what to expect when they hire a web developer",
      "What actually happens from 'I need a website' to 'it's live'",
      "The questions you should be asking any developer before you pay a cent",
      "What a good brief looks like and why it matters",
      "Why most website projects go over budget and how to avoid it",
      "What you need to have ready before you start building a website",
      "The difference between a website quote that makes sense and one that doesn't",
    ],

    hookStyles: [
      "Relatable situation",
      "Direct truth",
      "The thing nobody tells you upfront",
    ],

    copyPrompt: `Write a Value social media post that demystifies the process of getting a website built for a South African business owner.

Audience: Someone who wants a website but is nervous about being taken advantage of, doesn't know what to ask, and has probably heard a horror story from someone they know.

Topics to draw from:
- Most people have no idea what happens between "I want a website" and "here it is." The uncertainty makes them anxious and easy to overcharge.
- The questions every business owner should ask a developer before paying anything: who owns the site at the end? Where will it be hosted? What happens if something breaks?
- A clear scope saves money. Vague briefs lead to scope creep, extra charges, and disappointment.
- Red flags: a developer who can't explain their process, won't put a timeline in writing, or can't show you work they've done before.
- You should own your website completely when it's done. Domain, hosting access, code. If a developer is vague about this, that's a problem.
- What realistic timelines look like. Most simple sites don't take six months. If someone's quoting six months for a five-page site, ask why.

Rules:
- Be the honest guide they wish they'd had before. No condescension.
- Practical and actionable — give them something they can use.
- Build confidence, not fear. They can navigate this with the right information.
- End with a question like "What's the one thing you wish you'd known before building your first website?"`,

    imagePrompt: `Clean editorial photograph or minimal graphic. A notebook with a website brief or checklist, a laptop in the background, warm natural light. Organised, calm, professional. Real working environment feel. Square 1:1 format.`,
  },

  // ── TRUST SIGNALS ─────────────────────────────────────────
  {
    id: "trust_signals",
    name: "Trust Signals",
    type: "value",
    category: "trust",
    description: "Ownership, direct communication, no lock-in — stated in plain language",

    angles: [
      "Who actually owns your website — it might not be you",
      "What happens to your business if your developer disappears",
      "The lock-in problem most business owners don't discover until it's too late",
      "Why owning your code matters more than most people think",
      "Direct access vs being managed — the difference it makes",
      "What 'hosted for you' actually means and why it matters",
      "The hidden dependency that leaves businesses stuck",
    ],

    hookStyles: [
      "Surprising fact",
      "Direct truth",
      "Relatable situation",
    ],

    copyPrompt: `Write a Value social media post about website ownership, lock-in, and what it means to truly own your digital presence. For South African business owners.

The core insight to build around (choose one angle per post, never repeat):
- Most business owners don't actually own their website. They own the content. The code, the hosting, the access — often stays with the developer. That's a risk.
- Ghost developers are common. What happens to your business when the only person with access to your website stops responding?
- Platform lock-in: if you can't move your site without losing everything, you don't own it. You rent it.
- Direct access means you can always get into your own website, move it, fix it, or hand it to someone else. Without asking permission.
- Some "website packages" include hosting at a markup, with no way for the client to ever get their own hosting. That's a business risk hiding inside a convenience.
- Owning your code means you can take it anywhere. No one can hold your business hostage.

Rules:
- Don't be alarmist. Be honest and matter-of-fact.
- The Rebel Designs position (client owns everything) should come through in the way the post is framed — not stated as a pitch.
- This is a trust-building post. Confidence, not fear.
- End with a question they can reflect on: "Do you know where your website is hosted right now? Could you access it if you needed to?"`,

    imagePrompt: `Clean, confident graphic. A key or padlock icon in a minimal editorial style — dark background, white and red accents. Or a stylised illustration of a handover — documents, keys, ownership. Professional, simple, no stock art. Square 1:1 format.`,
  },

  // ── SA BUSINESS CONTEXT ───────────────────────────────────
  {
    id: "sa_business",
    name: "SA Business Context",
    type: "value",
    category: "sa",
    description: "The specific realities of running a digital business in South Africa",

    angles: [
      "Why South African businesses need local payment options, not just global ones",
      "WhatsApp is how South African customers actually communicate",
      "Mobile-first isn't optional in South Africa — it's the baseline",
      "What building for the South African market actually means",
      "Why international website templates often don't work for SA businesses",
      "The South African customer journey is different and most overseas-built sites miss it",
      "Local context matters — and most template-built sites ignore it entirely",
    ],

    hookStyles: [
      "Direct truth",
      "Relatable situation",
      "Surprising fact",
    ],

    copyPrompt: `Write a Value social media post about the specific context of building a digital presence for a South African business.

Audience: South African business owners who have either used international platforms/templates or are about to make their first website decision.

Topics to draw from:
- Most South African customers use their phones to find businesses. A desktop-first website design is already wrong before you start.
- Payment methods matter locally. If your online store doesn't offer EFT, Paystack, or other local options — you'll lose customers who won't use international credit card systems.
- WhatsApp isn't optional for South African businesses. Customers expect to be able to reach you there. A website that ignores WhatsApp ignores how your customers communicate.
- International website builders and templates are designed for US/UK markets. Currencies, payment flows, even language defaults are often wrong out of the box.
- Data costs still matter for a significant portion of South African internet users. A heavy, slow website isn't just annoying — it costs your customer money.
- Local context in design and copy matters. Customers notice when something feels generic vs when it feels like it was made for them.

Rules:
- Speak from genuine local knowledge. This should feel like it comes from someone who actually builds for this market.
- No condescension about international tools — just honest practical reality.
- End with a question they can relate to locally.`,

    imagePrompt: `Warm editorial photograph with South African context. A business setting — a restaurant, a market stall, a retail space — with a phone showing a website or digital tool. Authentic, local feel. Natural light. Real environment. Square 1:1 format.`,
  },

  // ── CLIENT REALITY ────────────────────────────────────────
  {
    id: "client_reality",
    name: "Client Reality",
    type: "value",
    category: "trust",
    description: "The frustrations business owners have with developers — make them feel seen",

    angles: [
      "The developer who went quiet after taking payment",
      "Being told 'that's not in scope' for something you assumed was included",
      "Getting a template sold to you as custom work",
      "The website that looked great at launch and broke six months later",
      "Not being able to update your own content without paying someone",
      "Being quoted R50,000 for something that should cost R15,000",
      "The project that took eight months and cost more than the original quote",
    ],

    hookStyles: [
      "Relatable situation",
      "Direct truth",
      "Contrast: what most people do vs what works",
    ],

    copyPrompt: `Write a Value social media post that names a real frustration South African business owners have had with developers or getting a website built.

The goal is for the reader to feel seen — to read it and think "yes, that happened to me" or "that's exactly what I'm worried about."

Frustrations to draw from (rotate, never repeat the same one):
- The developer who went silent after taking half the payment. No replies. No refund. No site.
- Being charged extra for "that's not included" on things that seemed obvious.
- A template sold as custom work — you recognise it six months later on three other sites.
- A website that worked at launch and then started breaking without any changes being made.
- A CMS that's impossible to use without calling the developer. You can't change your own hours or prices without help.
- Quotes that start at one number and end somewhere very different by invoice day.
- A website that looks good on a desktop but terrible on a phone — and the developer says that's fine.

Rules:
- Name the frustration clearly and without exaggeration. It's real, not dramatised.
- Do NOT bash developers as a group. Focus on the situation, not "bad developers."
- The post should end with a question that invites people to share their own experience.
- This builds trust because it shows honest awareness of what the industry often gets wrong.`,

    imagePrompt: `Honest, real editorial photograph. A business owner at a laptop with a slightly frustrated or focused expression. Real desk, real environment. Not posed. Warm lighting. The feeling of someone trying to sort something out. Square 1:1 format.`,
  },

  // ── FOUNDER / BUILDER PERSPECTIVE ────────────────────────
  {
    id: "trust_builder",
    name: "Founder & Builder Perspective",
    type: "value",
    category: "builder",
    description: "Behind-the-scenes, human, build-in-public posts. First-person allowed.",

    angles: [
      "Why I build everything from scratch instead of using templates",
      "What I've learned from building websites for South African businesses",
      "The reason I give clients complete ownership of their code",
      "What the process actually looks like from my side",
      "A project I'm proud of and why",
      "The thing most developers don't tell their clients",
      "Why I started Rebel Designs",
    ],

    hookStyles: [
      "Direct truth",
      "Relatable situation",
      "The thing nobody tells you upfront",
    ],

    copyPrompt: `Write a Value social media post from the perspective of Nastasia, the founder of Rebel Designs. First-person is allowed and encouraged here. This should feel human and direct — not like marketing.

Topics to draw from (rotate, never repeat):
- Why I build from scratch instead of using templates. Short version: templates weren't built for your business.
- What I actually care about when I take on a project — that it works, that you own it, that I can stand behind it.
- The reason I hand over complete ownership at the end of every project. I've seen what happens when clients don't own their site.
- What the first week of a project looks like and why the brief matters so much.
- Something I built that I'm genuinely proud of and why.
- What I'd tell someone starting the process of getting their first website.
- Why I'm upfront about pricing even when it's uncomfortable.

Rules:
- First-person ("I") is natural and expected here.
- Warm, honest, direct. Not humble-bragging. Not false modesty.
- The post should make someone feel like they'd be dealing with a real person, not a company.
- Short sentences. Plain language.
- End with a question that invites the reader to engage ("What's the one thing you'd want to know before hiring a developer?")`,

    imagePrompt: `Authentic editorial photograph. A developer at work — laptop on a real desk, notebooks, coffee, maybe a second screen. Natural light. Not posed. The feel of someone actually building something, not performing productivity. Square 1:1 format.`,
  },

  // ── SHOWCASE: Real Work ────────────────────────────────────
  {
    id: "lab_showcase",
    name: "Work Showcase",
    type: "lab",
    category: "lab",
    description: "Show real work — GameSir ZA, Document Validation Engine, social media agent, etc.",

    angles: [
      "The e-commerce platform built for a South African gaming brand",
      "The fraud detection tool that catches tampered documents automatically",
      "The social media agent that generates and posts content autonomously",
      "What a properly built online store looks like under the hood",
      "A project built for a South African business — what the brief was and what got built",
    ],

    hookStyles: [
      "Direct truth",
      "Surprising fact",
      "Contrast: what most people do vs what works",
    ],

    copyPrompt: `Write a Showcase social media post introducing one of Rebel Designs' live projects as proof of what's possible.

Projects to choose from (rotate, never repeat the same one):

1. GameSir ZA (gamesir.co.za)
   - South African gaming peripherals e-commerce store
   - Automated order fulfilment, Paystack payment integration
   - Built to run without manual intervention
   - The point: a store that handles orders, payments, and fulfilment without the owner having to be involved in every transaction

2. Document Validation Engine (rebeldesigns.co.za)
   - Detects tampered PDFs automatically — the kind of fraud that looks real to the human eye
   - Businesses that handle proof-of-payment documents are exposed to this risk
   - Built for financial protection, not just compliance
   - The point: custom tools can protect your business from things manual processes can't catch

3. Autonomous Social Media Agent (rebeldesigns.co.za)
   - Generates and posts content to Facebook and Instagram automatically
   - Analyses trends, writes platform-specific captions, manages scheduling
   - Human approval gate before anything goes live
   - The point: consistent posting without the business owner spending hours on content every week

Rules:
- Lead with the business problem the project solved, not the technology.
- Speak in plain language — what it does, why it matters, what changed for the business.
- Make the reader see what's possible for their own business.
- End with a soft CTA: "This is the kind of thing we build. See more at rebeldesigns.co.za"
- Include ONE link: rebeldesigns.co.za`,

    imagePrompt: `Clean, premium product showcase photograph or graphic. A laptop showing the live website or tool — GameSir ZA storefront, a dashboard, or a social media feed. Dark background, professional presentation. Real and polished. Square 1:1 format.`,
  },

  // ── SHOWCASE: AI Tools ────────────────────────────────────
  {
    id: "lab_ai_tools",
    name: "AI Tools Showcase",
    type: "lab",
    category: "lab",
    description: "Sell the AI tools offering — WhatsApp bots, social media agents, custom automation",

    angles: [
      "A WhatsApp bot that handles inquiries 24/7 so the owner doesn't have to",
      "The social media agent running Rebel Designs' own accounts",
      "What a custom AI tool looks like for a small South African business",
      "The automation that replaced a task someone was doing manually every day",
    ],

    hookStyles: [
      "Relatable situation",
      "Surprising fact",
      "Direct truth",
    ],

    copyPrompt: `Write a Showcase social media post about Rebel Designs' AI tools offering — specifically WhatsApp chatbots, social media agents, or custom AI automation.

What to sell:
- WhatsApp chatbots: handles customer inquiries, sends price lists, qualifies leads, takes bookings — all automatically, all hours of the day.
- Social media agents: generates content, schedules posts, manages the content calendar — without the business owner doing it manually.
- Custom AI tools: anything repetitive or time-consuming in a business that could be automated with the right build.

The framing that works:
- These tools are built for South African business owners who are too busy to do everything manually.
- Not a generic off-the-shelf chatbot. Built for your specific business.
- The social media agent is the exact tool running Rebel Designs' own accounts — it's not theoretical, it's live.

Rules:
- Lead with the pain it solves ("Answering WhatsApp all day is a job. It shouldn't be yours.")
- Show what changes after the tool is in place.
- Keep it plain and relatable. No technical explanation of how it works.
- End with a CTA: "Want to see what this could look like for your business? rebeldesigns.co.za"
- Include ONE link: rebeldesigns.co.za`,

    imagePrompt: `Modern, clean dark graphic. A phone screen showing a WhatsApp chat with instant automated replies, or a social media feed with scheduled posts going live. Minimal, professional, dark background. One red accent element. Real and functional looking. Square 1:1 format.`,
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
// Value pool (~70%) distributed across trust, ai, sa, and builder.
// Lab pool (~30%) split between showcase rotations.
//
// BASE_WEIGHTS:
//   trust_web:        60  — core website pitch
//   trust_ecommerce:  55  — e-commerce pitch
//   ai_whatsapp:      65  — WhatsApp bot sell
//   ai_social:        60  — social media agent sell
//   trust_process:    50  — demystify / trust
//   trust_signals:    50  — ownership / lock-in
//   sa_business:      45  — local context
//   client_reality:   50  — empathy / trust builder
//   trust_builder:    30  — founder voice
//   lab_showcase:     55  — real work proof
//   lab_ai_tools:     55  — AI tools sell
// ─────────────────────────────────────────────────────────────

const BASE_WEIGHTS = {
  trust_web:        60,
  trust_ecommerce:  55,
  ai_whatsapp:      65,
  ai_social:        60,
  trust_process:    50,
  trust_signals:    50,
  sa_business:      45,
  client_reality:   50,
  trust_builder:    30,
  lab_showcase:     55,
  lab_ai_tools:     55,
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
