# Form copy for the GoHighLevel build

Every form on the site is a placeholder (`data-fw-demo`): it says it isn't connected yet and sends nothing. Use this guide to rebuild each one as a native GHL form, then swap it into the same section. The field labels, options, helper text and messages below are the ones on the pages. Sources are the developer brief (§5 lead journeys and form requirements, §12 landing page copy, §14 development specification).

Field types use GHL's names. **Req** means required.

---

## Rules for every form (brief §5, §14)

- **Labels:** every field has a visible label, never only a placeholder.
- **Errors:** check required fields and show error messages that screen readers announce.
- **No duplicates:** disable the button after one click, and add spam protection (reCAPTCHA or a honeypot).
- **Success:** show success only after the record is saved. The message names what the person asked for and the next step.
- **Failure:** keep everything they typed and show "We could not complete your request. Please try again." Also offer the contact email, ibelieve@faithph.ai.
- **Hidden fields on every form:**
  - `source_page`
  - `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content` (when present)
  - `offer_id` (form, event or lead-magnet ID)
  - `submitted_at` (timestamp)
  - `consent_marketing` (yes/no) and `consent_wording_version`
- **Privacy:** link the Privacy Notice (`privacy.html`) on every form.
- **Marketing consent:** keep it separate from the request, and never pre-tick it.
- **Analytics:** never send names, emails or message text.
- **Before notifications go on:** confirm the inbox, CRM pipeline and owner for each form.

---

## 1. Starter kit request

- **Page:** `free-ai-starter-kit.html#get-the-kit`
- **Journey:** resource seeker → `free-ai-starter-kit-thank-you.html`
- **Owner:** TBC (Marketing / Projects)
- **Do not publish** until the final kit file, the Privacy Notice and the delivery email are ready (brief §12).

**Card title:** Get your free starter kit.

| Field | Type | Req | Options / notes |
| --- | --- | --- | --- |
| First name | Single line | Yes | Trim whitespace; reject whitespace-only |
| Email address | Email | Yes | Normalize (lowercase, trimmed); update an existing contact, don't duplicate |
| Your role (optional) | Dropdown | No | Founder/Business Owner · Professional/Freelancer · Team/HR Leader · Other |
| *Send me practical AI tips and updates about Faith Works programs. I can unsubscribe anytime.* | Checkbox | No | **Unchecked** by default. Stores marketing consent only |
| Hidden: `lead_magnet_id` | Hidden | — | `ai-workflow-starter-kit` |
| Hidden: `lead_magnet_version` | Hidden | — | Kit version, e.g. `v1.0` |

**Service notice** (under the fields): We will use your details to deliver the kit you requested. Read our Privacy Notice.

**Button:** Send Me the Free Starter Kit

**On success:** redirect to `free-ai-starter-kit-thank-you.html`. That page says:

- **Heading:** Your starter kit is ready.
- **Primary button:** Download the Starter Kit (links to the approved kit file)
- **Text:** We are also sending a copy to the email you provided. If it does not arrive, check spam or request another copy.
- **Secondary:** Explore learning pathways. For team leaders: Explore corporate training.

**If email delivery is pending:** Your starter kit is ready to download. Your email copy is on its way and may take a few minutes.

**On failure:** We could not complete your request. Please try again. *(Keep the entries.)*

**Automation (brief §13, §14):**

- **Email 0:** send it once the record is saved, whether or not the box is ticked.
- **Emails 1–3:** send them only when `consent_marketing = yes`.
- **Repeat requests:** resend the kit (rate-limited), but don't restart the sequence.
- **Team/HR Leader:** for this role, Email 3 uses the corporate version.
- **Email copy:** brief §13.

---

## 2. Corporate inquiry (Request a proposal)

- **Page:** `business.html#enquire`
- **Journey:** corporate buyer → confirmation → assigned follow-up
- **Owner:** TBC (corporate leads)

**Heading:** Bring this to your team.

**Intro:** Help your team move from AI awareness to practical adoption. Faith Works designs learning experiences around your people, priorities, and workflows, with guided practice and clear next steps. Tell us your goals so we can recommend the right scope.

| Field | Type | Req | Options / notes |
| --- | --- | --- | --- |
| Name | Single line | Yes | |
| Work email | Email | Yes | |
| Company | Single line | Yes | |
| Your role | Single line | Yes | |
| Team size | Dropdown | Yes | 2–10 · 11–50 · 51–200 · 200+ |
| Preferred format | Dropdown | No | Open to a recommendation · Online · In person · Hybrid |
| What are your goals for your team? | Multi line | Yes | |
| Preferred date (optional) | Single line | No | |
| Budget range (optional) | Single line | No | |

**Notice:** We will use your details to respond to your inquiry. Read our Privacy Notice.

**Button:** Request a proposal

**On success:** Thank you. We have your request for corporate training and will be in touch about next steps. *(Add the response time once it's agreed.)*

**On failure:** We could not complete your request. Please try again, or email ibelieve@faithph.ai.

---

## 3. Speaking and partnership inquiry

- **Page:** `speaking.html#inquiry`
- **Journey:** speaking → inquiry → confirmation; the event brief goes to the booking owner
- **Owner:** TBC (bookings)

**Heading:** Tell us about your event.

**Intro:** Share the basics and we will come back with a tailored proposal.

| Field | Type | Req | Options / notes |
| --- | --- | --- | --- |
| Organization | Single line | Yes | |
| Contact name | Single line | Yes | |
| Email | Email | Yes | |
| Event name | Single line | Yes | |
| Event date | Date | Yes | |
| Location | Single line | Yes | Placeholder: City and venue, or online |
| Audience size | Number | Yes | |
| Requested format | Dropdown | Yes | Learn with Faith (workshop or training) · Hear from Faith (keynote or talk) · Partner with Faith (brand partnership) · Not sure yet |
| Who is the audience? | Multi line | Yes | |
| Budget (optional) | Single line | No | |

**Notice:** We will use your details to respond to your inquiry. Read our Privacy Notice.

**Button:** Send booking inquiry

**On success:** Thank you. We have your event details and will come back with a tailored proposal.

**On failure:** We could not complete your request. Please try again, or email ibelieve@faithph.ai.

---

## 4. Faith AI demo request

- **Page:** `build.html#faith-ai`
- **Journey:** Faith AI prospect → demo inquiry; store the use case
- **Owner:** TBC
- **No purchase promise:** no prices or plans on this form (brief §4, §9).

**Heading:** Request a demo

| Field | Type | Req | Options / notes |
| --- | --- | --- | --- |
| Name | Single line | Yes | |
| Work email | Email | Yes | |
| Company | Single line | Yes | |
| Which business process needs support? | Multi line | Yes | Placeholder: For example, inquiry tracking or follow-up |
| Tools you use today (optional) | Single line | No | |

**Notice:** We will use your details to arrange your demo. Read our Privacy Notice.

**Button:** Request a Demo

**On success:** Thank you. We have your demo request and will contact you to arrange a time.

**On failure:** We could not complete your request. Please try again, or email ibelieve@faithph.ai.

---

## 5. General contact

- **Page:** `contact.html#inquiry`
- **Owner:** TBC
- **Also used for:** program waitlists and "Ask about the next intake" links (from `learn.html#programs`) until each program has its own registration or waitlist form.

**Heading:** Send us a message.

| Field | Type | Req | Options / notes |
| --- | --- | --- | --- |
| Name | Single line | Yes | |
| Email | Email | Yes | |
| Inquiry type | Dropdown | Yes | Programs and workshops · Corporate training · Speaking and partnerships · Faith AI · Something else |
| Phone (optional) | Phone | No | Optional unless operationally necessary (brief §5) |
| Message | Multi line | Yes | |

**Notice:** We will use your details to respond to your inquiry. Read our Privacy Notice.

**Button:** Send message

**On success:** Thank you. We have your message and will route it to the right person.

**On failure:** We could not complete your request. Please try again, or email ibelieve@faithph.ai.

---

## 6. Updates sign-up (footer, every page)

- **Where:** `.fw-footer__join` in the footer
- **Consent:** this form *is* marketing consent. Record it as consent (wording + timestamp).

**Heading:** Get Faith Works updates

**Intro:** Practical AI tips and news about workshops and programs. Unsubscribe anytime. Privacy Notice

| Field | Type | Req |
| --- | --- | --- |
| First name | Single line | Yes |
| Email address | Email | Yes |

**Button:** Subscribe

**On success:** You're subscribed. Look out for practical AI tips and program news. You can unsubscribe anytime.

**On failure:** We could not complete your request. Please try again.

---

## 7. "Hear about it first" (new dates and resources)

- **Pages:** `community.html#register` (new dates) and `build.html#access` (resources sent by email)
- **Consent:** this is a service request ("tell me when…"). Don't add the contact to marketing emails unless they also opt in.

**Heading:** Hear about it first.

**Intro:** Notify me about upcoming workshops, events, and new resources.

| Field | Type | Req | Options / notes |
| --- | --- | --- | --- |
| I'd like to hear about (Build page only) | Dropdown | No | Prompt Starter Kit & Tools Guide · AI Opportunity Map · AI-Assisted Research Workflow *(options come from `resources.json`)* |
| Name | Single line | Yes | |
| Email address | Email | Yes | |

**Notices:**

- Community: We will use your details to tell you about new dates. Read our Privacy Notice.
- Build: We will use your details to send what you asked for. Read our Privacy Notice.

**Button:** Notify me

**On success:** Thank you. We will email you when it's available.

**On failure:** We could not complete your request. Please try again.

---

## 8. To build when a program opens: registration or waitlist

There is no form on the site for this yet. Program and event registration currently goes to each event's `registrationUrl` in `events.json`.

When a program opens, use these fields (brief §5): name, email, selected program or event (hidden or preselected), and only the attendance details actually needed. Don't collect unrelated sensitive information.

**On success:** You're registered for {program}. Next step: {next step}.

**Payment:** if the program is paid, use an approved hosted checkout. A seat is confirmed only after payment is verified (brief §5).
