// Schema.org JSON-LD for the GHL pages (build.mjs) and the GHL Resources page (poc/ghl-resources-cms).
// One @graph per page, built only from what the page and the CMS settings already say: the
// Organization and WebSite are the same entities on every page (stable @ids on the site origin),
// each page adds its WebPage, its BreadcrumbList (matching the visible "crumbs" where the page has
// them) and, where the page really is about one, a Person, Service or Event list.
// Nothing invented: no ratings, prices, addresses or dates that the CMS does not hold.

export const BRAND = "Faith Works"; // the name every page title uses; the CMS brand ("Faith Works PH") is the alternate

// The hierarchy each GHL page sits in (name as the site navigation names it). Speaking and
// Workshops follow their visible crumbs (For Business / Speaking, Learn AI / Workshops).
export const PAGE_TRAILS = {
  home: [],
  about: [["About", "/about"]],
  build: [["Build with AI", "/build"]],
  business: [["For Business", "/business"]],
  community: [["Community", "/community"]],
  learn: [["Learn AI", "/learn"]],
  professionals: [["For Professionals", "/professionals"]],
  speaking: [["For Business", "/business"], ["Speaking", "/speaking"]],
  workshops: [["Learn AI", "/learn"], ["Workshops", "/workshops"]],
  resources: [["Resources", "/resources"]],
  contact: [["Contact", "/contact"]],
  privacy: [["Privacy Notice", "/privacy"]],
  terms: [["Terms of use", "/terms"]],
  "start-your-ai-journey": [["Free AI Workflow Starter Kit", "/start-your-ai-journey"]],
  // Program pages: their visible crumbs (Learn AI / program); the program's own name is added by the caller
  program: [["Learn AI", "/learn"]],
  // Article pages (resources/<slug>): Resources / the article's title, added by the caller
  article: [["Resources", "/resources"]],
};

const abs = (origin, p) => (/^https?:\/\//i.test(p || "") ? p : origin + (p || "/"));

export function ids(origin) {
  return { org: `${origin}/#organization`, site: `${origin}/#website`, founder: `${origin}/about#faith-natividad` };
}

export function organization(site, origin, cdn, { withFounder = false } = {}) {
  const id = ids(origin);
  return clean({
    "@type": "Organization", "@id": id.org, name: BRAND, alternateName: site.brand && site.brand !== BRAND ? site.brand : undefined,
    url: `${origin}/`, logo: site.logo ? { "@type": "ImageObject", url: abs(cdn, site.logo) } : undefined,
    email: site.contactEmail || undefined, telephone: site.contactPhone || undefined,
    slogan: site.footerTagline || undefined,
    // Only the brand's own profiles: the founder's LinkedIn belongs to the Person
    sameAs: (site.social || []).map((s) => s.url).filter((u) => !/linkedin\.com\/in\//i.test(u)),
    founder: withFounder ? { "@id": id.founder } : undefined,
  });
}

export function website(site, origin) {
  const id = ids(origin);
  return clean({
    "@type": "WebSite", "@id": id.site, name: BRAND, alternateName: site.brand && site.brand !== BRAND ? [site.brand] : undefined,
    url: `${origin}/`, inLanguage: "en", publisher: { "@id": id.org },
  });
}

export function breadcrumb(origin, url, trail) {
  if (!trail.length) return null;
  return {
    "@type": "BreadcrumbList", "@id": `${url}#breadcrumb`,
    itemListElement: [["Home", "/"], ...trail].map(([name, p], i) => ({ "@type": "ListItem", position: i + 1, name, item: abs(origin, p) })),
  };
}

export function webPage({ origin, url, title, description, image, type = "WebPage", trail = [], mainEntity, about }) {
  const id = ids(origin);
  return clean({
    "@type": type, "@id": `${url}#webpage`, url, name: title, description, inLanguage: "en",
    isPartOf: { "@id": id.site }, about: about || { "@id": id.org },
    primaryImageOfPage: image ? { "@type": "ImageObject", url: image } : undefined,
    breadcrumb: trail.length ? { "@id": `${url}#breadcrumb` } : undefined,
    mainEntity,
  });
}

// The founder, as the About page presents her: only her name, page, picture and own profile
export function person(site, origin, { description, image } = {}) {
  const id = ids(origin);
  return clean({
    "@type": "Person", "@id": id.founder, name: "Faith Natividad", url: `${origin}/about`, description, image,
    worksFor: { "@id": id.org },
    sameAs: (site.social || []).map((s) => s.url).filter((u) => /linkedin\.com\/in\//i.test(u)),
  });
}

// What a service or program page offers, named and described as the page does
export function offer(type, { origin, url, name, description, image, serviceType }) {
  return clean({
    "@type": type, "@id": `${url}#${type.toLowerCase()}`, name, description, url, image,
    serviceType,
    provider: { "@id": ids(origin).org },
  });
}

// A resource's article page: headline, description, image and date as the CMS holds them. The
// author is the Organization when the CMS names the brand, else an Organization by that name.
export function article(site, { origin, url, headline, description, image, published, author }) {
  const id = ids(origin);
  const own = !author || author === BRAND || author === site.brand;
  return clean({
    "@type": "Article", "@id": `${url}#article`, headline, description, image: image ? [image] : undefined,
    datePublished: published || undefined, author: own ? { "@id": id.org } : { "@type": "Organization", name: author },
    publisher: { "@id": id.org }, mainEntityOfPage: { "@id": `${url}#webpage` }, inLanguage: "en",
  });
}

// Upcoming events as the CMS holds them (data.events from tools/content.mjs). Online events (a venue
// that says "Online") get a VirtualLocation at their registration address; anything else a Place
// named and addressed by the venue text, as written in the CMS.
export function events(list, origin, cdn, now = new Date()) {
  const id = ids(origin);
  const today = now.toISOString().slice(0, 10);
  return list
    .filter((e) => e.start && e.title && e.venue && (e.end || e.start).slice(0, 10) >= today)
    .map((e) => {
      const reg = e.registration && e.registration.url ? abs(origin, e.registration.url) : undefined;
      const online = /^\s*online\b/i.test(e.venue);
      return clean({
        "@type": "Event", "@id": `${origin}/workshops#event-${e.slug}`, name: e.title, description: e.summary || e.metaDescription || undefined,
        startDate: e.start, endDate: e.end || undefined,
        eventStatus: "https://schema.org/EventScheduled",
        eventAttendanceMode: `https://schema.org/${online ? "Online" : "Offline"}EventAttendanceMode`,
        location: online ? (reg ? { "@type": "VirtualLocation", url: reg } : undefined) : { "@type": "Place", name: e.venue, address: e.venue },
        image: e.image && e.image.src ? [abs(cdn, e.image.src)] : undefined,
        url: reg, organizer: { "@id": id.org },
      });
    });
}

export function graph(nodes) {
  return { "@context": "https://schema.org", "@graph": nodes.filter(Boolean) };
}

// As a <script> (no "</" inside, so the JSON cannot end the element early)
export function ldScript(data, attrs = "") {
  return `<script type="application/ld+json"${attrs ? ` ${attrs}` : ""}>${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`;
}

function clean(o) {
  for (const k of Object.keys(o)) if (o[k] === undefined || (Array.isArray(o[k]) && !o[k].length)) delete o[k];
  return o;
}
