// ============================================================
// REBEL ENGINE — Resource Snapshot (lib/resources.js)
//
// Feeds verified content to the AI before every generation call.
// Prevents hallucination of URLs, project names, and brand facts.
//
// Each project includes:
//   topicSignals[]           — rich context for generation prompts
//   architectureHighlights[] — structured tech bullets for AI extraction
//   contentHooks[]           — sharp opening angles the AI can pull from
//   authoritySignals[]       — expert-level insights that prevent generic output
//   antiHallucinationTerms[] — exact terminology the AI must use (no paraphrasing)
//   audienceTargets[]        — who the post is for
//   storyMoments[]           — human narrative angles for founder/lab posts
//   technicalDepth[]         — specific technical details that must appear
//
// Two sources:
//   1. Live fetch from rebeldesigns.co.za (if RESOURCES_SUMMARY_URL is set)
//   2. Hardcoded snapshot below — always accurate, update manually
//      when you add new projects, tools, or resources.
//
// Last updated: 2026-03 — post website revamp
// ============================================================

const LIVE_URL = process.env.RESOURCES_SUMMARY_URL;

export async function fetchResourceSnapshot() {
  if (LIVE_URL) {
    try {
      const res = await fetch(LIVE_URL, { signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        const data = await res.json();
        return { ...data, source: "live", timestamp: new Date().toISOString() };
      }
    } catch {
      // Fall through to hardcoded snapshot
    }
  }

  return { ...SNAPSHOT, source: "hardcoded", timestamp: new Date().toISOString() };
}

// ─────────────────────────────────────────────────────────────
// HARDCODED SNAPSHOT
// Update this whenever you add new content to the site.
// ─────────────────────────────────────────────────────────────

const SNAPSHOT = {

  snapshotVersion: "2026-03-website-rebuild",

  // ── Live tools ───────────────────────────────────────────
  tools: [
    {
      name: "Password Roast",
      description: "Client-side security UX tool. Rates password strength in real time with brutal, witty commentary. Zero server-side transmission — no passwords ever leave the browser. Built on real-time entropy calculation, not simple length checks.",
      url: "https://passwordroast.netlify.app",
      status: "production",

      topicSignals: [
        "client-side security architecture",
        "password entropy calculation",
        "security UX design",
        "zero data transmission pattern",
        "real-time feedback systems",
      ],

      architectureHighlights: [
        "Client-side only — no passwords transmitted to any server",
        "Real-time entropy scoring (not length-based heuristics)",
        "Brutally honest UX feedback to make security non-ignorable",
      ],

      authoritySignals: [
        "Entropy-based scoring detects weak passwords that pass naive length checks",
        "Client-side execution eliminates the attack surface of server-side transmission",
        "Security UX that is boring is security UX that gets bypassed",
      ],

      technicalDepth: [
        "Shannon entropy calculation",
        "character set diversity scoring",
        "real-time pattern detection",
        "client-side cryptographic heuristics",
      ],

      storyMoments: [
        "The realisation that most password tools create false confidence",
        "The architectural decision to never transmit a password, even for scoring",
        "Designing feedback that users actually read instead of dismiss",
      ],

      audienceTargets: [
        "developers",
        "startup founders",
        "security-conscious builders",
        "UX engineers",
      ],

      antiHallucinationTerms: [
        "Password Roast",
        "passwordroast.netlify.app",
        "entropy calculation",
      ],

      contentHooks: [
        "Sending passwords to a server for strength checking is architecturally wrong. Most tools do it anyway.",
        "Security feedback that gets ignored is security that failed. Boring UX is a security risk.",
        "The most important architectural decision in Password Roast is what it never does.",
      ],
    },
  ],

  // ── Infrastructure projects ───────────────────────────────
  projects: [
    {
      name: "Document Validation Engine",
      description: "Computer vision pipeline for detecting digital tampering in PDF documents. Layered forensic analysis cross-validates visual and embedded document signals. Built to reduce exposure to fraudulent proof-of-payment documents.",
      url: "https://rebeldesigns.co.za/Infrastructure",
      status: "production",
      category: "security",

      topicSignals: [
        "computer vision fraud detection",
        "PDF tampering analysis",
        "financial document security",
        "visual anomaly detection",
        "forensic metadata scanning",
        "layered security architecture",
        "proof-of-payment fraud",
      ],

      architectureHighlights: [
        "Python core engine",
        "OpenCV-based image preprocessing",
        "scikit-image anomaly analysis",
        "Error Level Analysis (ELA) layer",
        "Metadata forensic scanner",
        "Pixel heatmap inconsistency detection",
        "Structured batch-processing roadmap",
      ],

      authoritySignals: [
        "Layered forensic pipelines outperform single-method detection models",
        "Error Level Analysis exposes recompression artifacts invisible to human inspection",
        "Metadata inconsistencies often reveal tampering before visual anomalies appear",
        "A single detection method will always be defeated — layered analysis is the only reliable architecture",
      ],

      technicalDepth: [
        "compression artifact detection via ELA",
        "pixel-level anomaly scoring",
        "metadata forensic hash analysis",
        "image recompression comparison algorithms",
        "multi-signal cross-validation pipeline",
      ],

      storyMoments: [
        "A fraudulent proof-of-payment that passed visual inspection but failed forensic analysis",
        "The discovery that visual inspection alone fails at the pixel level",
        "The architectural decision to build layered detection instead of a single algorithm",
        "Realising that financial fraud prevention requires the same rigor as cybersecurity",
      ],

      audienceTargets: [
        "developers",
        "startup founders",
        "technical operators",
        "fintech builders",
        "anyone handling financial documents",
      ],

      antiHallucinationTerms: [
        "Document Validation Engine",
        "Error Level Analysis",
        "Pixel heatmap detection",
        "rebeldesigns.co.za/Infrastructure",
      ],

      contentHooks: [
        "Most businesses trust PDFs too easily. Digital tampering is invisible to the human eye.",
        "Visual inspection cannot detect digital tampering at the pixel level. The forensics require a pipeline.",
        "A single detection method will always be defeated. Layered analysis is the only reliable approach.",
      ],
    },

    {
      name: "GameSir ZA",
      description: "Full e-commerce infrastructure environment for a South African gaming peripherals brand. Structured inventory and payment flows, Paystack integration, automated fulfilment logic. Built for continuous operation without manual intervention.",
      url: "https://gamesir.co.za",
      status: "production",
      category: "commerce",

      topicSignals: [
        "e-commerce infrastructure",
        "Paystack payment integration",
        "automated fulfilment",
        "inventory management systems",
        "South African commerce",
        "continuous operation architecture",
      ],

      architectureHighlights: [
        "Paystack payment integration",
        "Automated fulfilment logic",
        "Structured inventory state management",
        "Designed for continuous operation without manual oversight",
      ],

      authoritySignals: [
        "Automated fulfilment removes the human bottleneck from the transaction loop",
        "Payment integration is a financial flow design problem, not just an API connection",
        "E-commerce infrastructure built for continuity handles failure states, not just happy paths",
      ],

      technicalDepth: [
        "Paystack webhook processing",
        "inventory state machine design",
        "automated order routing logic",
        "payment failure recovery flows",
      ],

      storyMoments: [
        "The point where manual order processing became a bottleneck",
        "Designing a system that operates without human intervention after launch",
        "The decision to build for continuity instead of just for launch",
      ],

      audienceTargets: [
        "e-commerce founders",
        "developers building commerce infrastructure",
        "South African startup operators",
      ],

      antiHallucinationTerms: [
        "GameSir ZA",
        "gamesir.co.za",
        "Paystack",
      ],

      contentHooks: [
        "An e-commerce system that requires manual intervention is not infrastructure. It is a job.",
        "Payment integration is not just connecting an API. It is designing a financial flow that handles failure.",
      ],
    },

    {
      name: "Multi-Tenant Commerce Platform",
      description: "Scalable SaaS commerce architecture serving multiple independent storefronts from a unified core. Designed for horizontal scalability without infrastructure duplication.",
      url: "https://rebeldesigns.co.za/Infrastructure",
      status: "in development",
      category: "commerce",

      topicSignals: [
        "multi-tenant architecture",
        "SaaS commerce infrastructure",
        "horizontal scalability",
        "tenant isolation",
        "Row-Level Security",
        "shared-service architecture",
        "storefront management",
      ],

      architectureHighlights: [
        "Tenant-aware routing layer",
        "Custom domain and subdomain handling",
        "Row-Level Security (RLS) tenant isolation",
        "Shared authentication services",
        "Modular storefront components",
        "Resource-optimised hosting strategy",
      ],

      authoritySignals: [
        "Row-Level Security isolates tenant data at the database layer, not the application layer",
        "Shared-service architecture separates infrastructure cost from customer count",
        "Horizontal scaling is a design decision made before the first line of code, not after the first failure",
        "Single-tenant builds duplicate infrastructure cost at every new customer",
      ],

      technicalDepth: [
        "Row-Level Security (RLS) policies",
        "tenant-aware query routing",
        "shared authentication token architecture",
        "subdomain-to-tenant resolution",
        "modular storefront composition",
      ],

      storyMoments: [
        "The moment a single-tenant architecture hit a wall at scale",
        "Designing tenant isolation at the database layer instead of the application layer",
        "The decision to build one platform that serves many instead of many platforms serving one",
      ],

      audienceTargets: [
        "SaaS founders",
        "developers building multi-tenant systems",
        "technical architects",
        "startup operators scaling a commerce product",
      ],

      antiHallucinationTerms: [
        "Multi-Tenant Commerce Platform",
        "Row-Level Security",
        "RLS",
        "rebeldesigns.co.za/Infrastructure",
      ],

      contentHooks: [
        "Building a separate system for each client is not scaling. It is duplicating problems.",
        "Multi-tenancy is the difference between a product and a service. The architecture decides which one you built.",
        "Horizontal scaling is a design decision made before the first line of code, not after the first scaling failure.",
      ],
    },

    {
      name: "QuickShap Social-Commerce Dashboard",
      description: "Lightweight transaction bridge between social media engagement and structured order fulfilment. Built for mobile-first social sellers on WhatsApp, TikTok, and Instagram.",
      url: "https://rebeldesigns.co.za/Infrastructure",
      status: "prototype",
      category: "commerce",

      topicSignals: [
        "social commerce infrastructure",
        "WhatsApp commerce",
        "mobile-first commerce",
        "social selling tools",
        "order fulfilment automation",
        "South African social commerce",
        "DM-to-transaction conversion",
      ],

      architectureHighlights: [
        "Link-to-chat conversion generator",
        "Mobile-first seller dashboard",
        "Inventory state toggling (in-stock / out-of-stock)",
        "Centralised order tracking layer",
        "Streamlined checkout routing",
        "Under 2-minute onboarding flow",
      ],

      authoritySignals: [
        "Social commerce fails at the infrastructure layer, not the product layer",
        "WhatsApp functions as a transaction channel for millions of South African businesses",
        "The gap between a viral post and a completed order is an infrastructure problem",
        "Mobile-first commerce means optimising for thumb reach and 3G data budgets simultaneously",
      ],

      technicalDepth: [
        "WhatsApp deep link generation",
        "mobile-first checkout flow design",
        "inventory state management for social sellers",
        "order tracking without storefront overhead",
        "low-friction onboarding under 2 minutes",
      ],

      storyMoments: [
        "The realisation that South African social sellers lose sales to DM chaos, not bad products",
        "Designing a commerce layer lighter than a full storefront but heavier than a DM thread",
        "The decision to optimise for WhatsApp as the primary transaction channel",
      ],

      audienceTargets: [
        "social sellers",
        "South African e-commerce founders",
        "mobile-first commerce builders",
        "developers building for African markets",
      ],

      antiHallucinationTerms: [
        "QuickShap",
        "rebeldesigns.co.za/Infrastructure",
      ],

      contentHooks: [
        "Social sellers lose revenue not because their product is wrong, but because their infrastructure layer is missing.",
        "WhatsApp is a commerce infrastructure layer for millions of South African businesses. Most tools treat it as a chat app.",
        "The gap between a viral post and a completed order is an infrastructure problem, not a marketing problem.",
      ],
    },

    {
      name: "Autonomous Content Strategy Agent",
      description: "Trend-aware content generation and distribution agent. Structured pipeline: trend analysis, brand voice conditioning, platform-specific formatting, weighted rotation system, performance feedback loop, lead detection. This is the engine that generated this post.",
      url: "https://rebeldesigns.co.za/Infrastructure",
      status: "production",
      category: "automation",

      topicSignals: [
        "autonomous content agents",
        "AI content pipeline",
        "brand voice conditioning",
        "performance feedback loops",
        "social media automation",
        "weighted rotation systems",
        "lead detection from social engagement",
        "structured content generation",
      ],

      architectureHighlights: [
        "Trend analysis layer (daily intelligence brief)",
        "Brand voice conditioning via system prompt",
        "Platform-specific formatting (Facebook vs Instagram)",
        "Weighted rotation system (70% value / 30% lab)",
        "Performance feedback loop (Meta Insights to rotation weights)",
        "Lead detection and scoring from post comments",
        "Human approval gate before any post goes live",
      ],

      authoritySignals: [
        "Consistent brand presence at scale requires a system, not a content calendar",
        "AI content agents differ from chatbots in one critical way: structured pipelines with defined failure modes",
        "Performance feedback loops that adjust rotation weights over time are the difference between automation and intelligence",
        "Human approval gates preserve brand integrity without sacrificing automation efficiency",
      ],

      technicalDepth: [
        "weighted rotation selection algorithm",
        "anti-repetition memory via post history injection",
        "angle + hook style randomisation before generation",
        "Meta Insights to rotation weight feedback loop",
        "lead scoring from comment sentiment analysis",
        "POPIA-compliant audit logging to GitHub",
      ],

      storyMoments: [
        "The decision to build a structured pipeline instead of a simple prompt-to-post loop",
        "The moment it became clear that content consistency requires infrastructure, not discipline",
        "Designing a human approval gate that keeps control without removing the value of automation",
        "Building the lead scanner as a side effect of publishing at volume",
      ],

      audienceTargets: [
        "founders building brand presence",
        "developers interested in AI pipelines",
        "marketing operators",
        "technical founders automating workflows",
      ],

      antiHallucinationTerms: [
        "Autonomous Content Strategy Agent",
        "rebeldesigns.co.za/Infrastructure",
        "weighted rotation system",
      ],

      contentHooks: [
        "Consistent brand presence at scale requires a system. A calendar is not a system.",
        "An AI content agent is not a chatbot. It is a structured pipeline with inputs, logic, and failure modes.",
        "This post was generated by an autonomous agent. The infrastructure that produced it is the product.",
      ],
    },
  ],

  // ── Resources ─────────────────────────────────────────────
  resources: [
    {
      name: "The Loot Vault",
      description: "Free and paid web assets, brand strategy resources, and infrastructure tools. Built to the same standard as client projects.",
      url: "https://rebeldesigns.co.za/resources",

      antiHallucinationTerms: [
        "The Loot Vault",
        "rebeldesigns.co.za/resources",
      ],

      contentHooks: [
        "Most free templates are shortcuts. These are built the way production systems are built.",
        "The standard applied to free resources is the standard applied to every client project.",
      ],
    },
  ],

  // ── Brand facts — use these exactly, never invent details ──
  brandFacts: {
    positioning: "Custom Shopify and WordPress builds for businesses that need it done properly",
    tagline: "Most websites are built for launch day. We build for year five.",
    capabilities: ["Shopify Development", "WordPress Development", "Web Application Development"],
    complianceApproach: "POPIA/PAIA compliance engineered into every build from day one. Not a checkbox. Not an afterthought.",
    ipPolicy: "Clients own 100% of their code. No lock-in. Keys handed over on delivery.",
    engagementModel: "Direct — no outsourcing layers. Defined scope. All submissions reviewed directly.",
    location: "South Africa",
    website: "rebeldesigns.co.za",
    infrastructurePage: "rebeldesigns.co.za/Infrastructure",
    resourcesPage: "rebeldesigns.co.za/resources",
    // contact details intentionally excluded — not needed by AI generation layer
    // POPIA: prevents real contact info from being passed to third-party AI operators
  },
};
