# Participant Recruitment Strategy

## 1. Product decision

Meridian should support two ways to recruit people into a study:

1. **Use my audience**: the customer uploads or connects people they are permitted to invite.
2. **Source participants for me**: Meridian recruits people who match the approved Study Plan.

Both paths must converge into the same screening, consent, quota, interview, quality, and incentive workflow. A sourced contact is not automatically a participant.

```text
Approved Study Plan
        |
Target audience, quotas, sample size, and exclusions
        |
        +-------------------------+
        |                         |
Customer-provided audience   Meridian-sourced audience
CSV / CRM / product users    Panels / ads / partners / referrals
        |                         |
        +-------------------------+
        |
Screening and consent
        |
Qualified candidates
        |
Study participants
        |
Form or AI-led phone interview
        |
Quality review, analysis, and incentive
```

## 2. Participant lifecycle

Meridian should distinguish prospective candidates from accepted study participants.

- **Candidate**: sourced or uploaded, but not yet qualified and consented.
- **Qualified candidate**: passed the study screener and relevant verification checks.
- **Participant**: accepted into the study and assigned to a quota or cohort.
- **Completed participant**: produced a usable response that passed quality review.

Suggested lifecycle:

```text
sourced
  -> invited
  -> screener_started
  -> qualified | disqualified
  -> consented
  -> accepted
  -> scheduled
  -> interview_started
  -> completed
  -> quality_approved | quality_rejected
  -> incentive_paid
```

Every status transition should retain its timestamp, actor, reason, source, and relevant instrument version.

## 3. Use my audience

The first version should accept CSV and spreadsheet uploads. CRM and data-warehouse integrations can follow after the import contract is stable.

The import workflow should:

- Map name, email, phone, locale, customer status, and study-specific attributes.
- Normalize and validate phone numbers and email addresses.
- Deduplicate within the upload, organization, and study.
- Preserve source and cohort metadata.
- Allow suppression lists and contact preferences.
- Require the customer to confirm that they are permitted to contact the audience for research.
- Send an invitation to opt in before initiating a call unless explicit permission for direct research calling is recorded.
- Run a screener when eligibility is not already established reliably.
- Assign accepted participants to quotas without exceeding quota limits.

Known customer attributes may help personalize an interview, but stale or uncertain attributes must not be presented as facts.

## 4. Source participants for me

Meridian-sourced recruitment should begin as a supervised managed service. The product should expose the workflow and progress while the Meridian team operates acquisition manually. This validates economics and quality before building deep advertising automation.

### 4.1 Recruitment sources

Meridian can combine several sources for one study:

- **Research panels**: Respondent for qualitative B2C/B2B recruitment and Cint for larger quantitative samples.
- **Targeted advertising**: Meta or other approved advertising platforms leading to a Meridian-hosted screener.
- **Community and creator partnerships**: trackable study links distributed by relevant community owners, gyms, associations, creators, newsletters, or local groups.
- **Referrals**: qualified participants share a source-specific referral link, with explicit controls against duplicate and coordinated responses.
- **Meridian panel**: consenting, quality-approved participants may separately opt in to future research.

Panel references:

- [Respondent Participant Recruiting API](https://developers.respondent.io/docs/Getting-started/introduction)
- [Respondent recruitment approach](https://help.respondent.io/en/articles/5482532-how-respondent-recruits-research-participants)
- [Cint Exchange Demand API](https://developer.cint.com/demand/docs/2025-05-27/reference/definitions)

### 4.2 Audience discovery is not identity scraping

An Audience Finder may search approved public sources and APIs to identify where a target audience gathers. It should produce communities, publishers, creators, associations, search terms, locations, languages, and permitted recruitment methods.

It should not build an outreach database by scraping identifiable consumers, social profiles, phone numbers, or email addresses. LinkedIn prohibits scraping profiles, and Meta requires permission for automated data collection:

- [LinkedIn User Agreement](https://www.linkedin.com/legal/user-agreement)
- [Meta Automated Data Collection Terms](https://www.facebook.com/legal/automated_data_collection_terms)

The safe acquisition boundary is:

```text
Discover a relevant audience source
        -> publish or place a recruitment invitation
        -> person voluntarily opens the screener
        -> collect explicit consent and necessary details
        -> create an identifiable candidate
```

### 4.3 Sourced recruitment workflow

1. Meridian derives respondent criteria from the approved Study Plan.
2. The customer reviews sample size, quotas, exclusions, incentive, and method.
3. Meridian provides a feasibility estimate, budget, and expected turnaround.
4. The customer approves the recruitment request and spending limit.
5. Meridian activates one or more approved sources.
6. Applicants complete a source-attributed screener and consent notice.
7. Meridian evaluates eligibility, duplicates, fraud signals, and quota availability.
8. Qualified candidates are accepted as participants.
9. Meridian triggers the approved form or phone interview.
10. Completed responses undergo quality review before incentive payment and analysis.

## 5. Targeted advertising

Targeted recruitment advertising is an established source for online consumer research, particularly for city-specific, category-specific, health, fitness, lifestyle, and hard-to-reach audiences. It should not be treated as a statistically representative sample by itself.

The advertisement should describe the research opportunity and incentive, then direct people to a Meridian screener. The advertising platform finds potential applicants; Meridian remains responsible for qualification and research quality.

Key risks include:

- Self-selection bias.
- Applicants misrepresenting themselves to obtain incentives.
- Duplicate or coordinated applications.
- Incorrect geography or demographics.
- No-shows and incomplete interviews.
- Advertising optimization toward cheap form submissions instead of valid completions.
- Overrepresentation of frequent social media users.

Controls should include hidden qualification logic, duplicate checks, phone or email verification, quota enforcement, source-level quality scoring, frequency limits, and payment only after a valid completion.

Useful references:

- [Meta Lead Ads](https://www.facebook.com/business/ads/ad-objectives/lead-generation?locale=en_GB)
- [Systematic review of social recruitment for nutrition and fitness studies](https://pubmed.ncbi.nlm.nih.gov/34669955/)

## 6. Screening, consent, and quality

The Study Designer should generate a draft screener from the approved target participant definition. A human must approve it before recruitment begins.

The screener should contain:

- Necessary demographic and geographic criteria.
- Behavioral criteria based on recent, observable behavior.
- Product or category usage criteria.
- Cohort and quota attributes.
- Exclusions and conflicts.
- Consent to participate and to receive the selected interview method.
- Recording and transcription consent where applicable.
- Incentive terms and data-use notice.

Avoid revealing every qualifying answer in the recruitment advertisement or screener wording. Questions should still be neutral and must not trick legitimate participants.

Quality checks may use:

- Contact verification.
- Duplicate identity, device, and response checks where lawful.
- Screener consistency.
- Interview duration and completion.
- Response depth, specificity, and internal consistency.
- Transcript evidence coverage.
- Prior participation frequency and quality.
- Human review for ambiguous rejections.

India's data protection framework requires careful treatment of purpose, notice, consent, withdrawal, retention, and deletion for identifiable personal data. Product and legal review should use the current official materials rather than relying on this document as legal advice:

- [MeitY Digital Personal Data Protection Act and materials](https://www.meity.gov.in/content/digital-personal-data-protection-act-2023)

## 7. Economics

Meridian should estimate and report **cost per quality-approved completion**, not merely cost per click or applicant.

```text
Cost per approved completion =
  advertising or panel fees
  + participant incentive
  + verification and payment costs
  + recruitment operations
  + invalid-response and no-show allowance
  divided by quality-approved completions
```

Initial planning ranges for India, to be replaced with Meridian's observed data:

| Audience | Estimated direct cost per valid completion |
| --- | ---: |
| Broad urban consumers | INR 800-2,000 |
| Specific category users | INR 1,500-4,000 |
| Rare, affluent, or tightly filtered consumers | INR 3,000-8,000 |
| B2B professionals | INR 5,000-15,000+ |

These are operating assumptions, not customer promises. The actual result depends on incidence rate, geography, duration, incentive, source, verification, and completion quality.

Example planning model for 30 consumer interviews:

| Item | Assumption | Estimated cost |
| --- | ---: | ---: |
| Recruitment applicants | 120 at INR 100 | INR 12,000 |
| Qualification | 35%, or about 42 people | - |
| Completion | 70%, or about 30 people | - |
| Participant incentives | INR 750 x 30 | INR 22,500 |
| Verification and payment | INR 150 x 30 | INR 4,500 |
| Testing and contingency | Fixed allowance | INR 6,000 |
| **Estimated total** | **30 completions** | **INR 45,000** |

Respondent currently publishes a pay-as-you-go consumer recruitment fee per completed session, with incentives charged separately. Production estimates must fetch or confirm current provider pricing rather than hard-code it. See [Respondent pricing](https://www.respondent.io/pricing).

## 8. Product surface

The Recruitment area of a study should contain:

- **Audience**: target criteria, cohorts, quotas, exclusions, and sample size.
- **Sources**: customer upload, panel, managed sourcing, campaigns, and referrals.
- **Screener**: versioned questions, rules, consent, and approval state.
- **Candidates**: applicant status, eligibility, source, verification, and rejection reason.
- **Participants**: accepted people and interview status.
- **Progress**: quota coverage, funnel conversion, cost, timing, and quality.
- **Incentives**: promised, pending, approved, rejected, and paid amounts.

The primary action can present two clear choices:

```text
Recruit participants
  [Use my audience]
  [Source participants for me]
```

The managed sourcing path should collect a budget cap and create an approval request. It should not imply that the agent can autonomously spend money or contact an unapproved audience.

## 9. Suggested data model

The existing `participants`, outreach, interview, and call records should remain the execution system. Recruitment adds a layer before participant acceptance.

Suggested entities:

- `recruitmentCampaigns`: study, mode, status, target, sample, budget, timing, and approval.
- `recruitmentSources`: panel, upload, advertising, partner, referral, or Meridian panel.
- `screenerVersions`: questions, branching, qualification rules, consent text, and approval.
- `recruitmentCandidates`: source identity, provided attributes, status, consent, verification, and participant link after acceptance.
- `quotaDefinitions`: target counts and qualifying dimensions.
- `candidateScreeningResults`: answers, derived eligibility, reasons, and screener version.
- `recruitmentEvents`: append-only funnel and audit history.
- `recruitmentCosts`: source spend, fees, incentives, refunds, and attribution.
- `incentivePayments`: amount, method, status, completion approval, and provider reference.

Sensitive candidate data should have explicit access controls, retention rules, deletion behavior, and audit history.

## 10. Validation plan

The goal of the first studies is to validate the whole pipeline, not merely prove that advertisements can produce form submissions.

### Stage 1: Customer-provided audience

- Validate mapping, normalization, deduplication, and suppression.
- Validate invitation consent and opt-out behavior.
- Confirm that qualified contacts flow into existing forms and calls.
- Measure delivery, acceptance, completion, and response quality.

### Stage 2: Managed sourcing pilot

- Manually create the targeting plan, campaign, and incentive.
- Recruit a small pilot wave before funding the complete sample.
- Compare applicants, qualified candidates, completions, cost, and quality by source.
- Record every manual operational step that should later become product behavior.

### Stage 3: Panel integration

- Integrate one provider after confirming API access and India feasibility.
- Preserve Meridian's screener, consent, source attribution, and quality checks.
- Reconcile provider completion and incentive status with Meridian records.

### Stage 4: Advertising automation

- Add provider account connection and campaign creation only after several manually operated studies.
- Require explicit customer approval for creative, targeting, budget, and launch.
- Import spend and conversion data into recruitment analytics.
- Keep pause controls and budget limits in code, not agent instructions.

### Stage 5: Meridian panel

- Offer a separate, optional consent for future study invitations.
- Track language, geography, verified attributes, participation frequency, and quality.
- Apply contact-frequency, conflict, diversity, and fatigue controls.
- Never silently convert a one-time study participant into a reusable panel member.

## 11. Validation metrics

Each study should report:

- Applicants by source.
- Screener start and completion rates.
- Qualification and rejection rates.
- Duplicate and suspected-fraud rates.
- Cost per applicant and qualified candidate.
- Acceptance, interview completion, and no-show rates.
- Cost per quality-approved completion.
- Time to first qualified participant and time to fill.
- Quota coverage and remaining incidence risk.
- Interview quality score by source.
- Incentives pending, approved, rejected, and paid.
- Opt-outs, complaints, and deletion requests.

These measurements should inform future feasibility estimates and source recommendations. The recruitment agent may recommend a source, but pricing, outreach approval, contactability, quota enforcement, and spending limits must remain deterministic product rules.

## 12. Recommended first release

The smallest release that validates the business model is:

1. CSV import with field mapping, validation, deduplication, and permission confirmation.
2. Versioned public screener with consent and source-specific links.
3. Candidate inbox with eligibility, verification, quota assignment, and approval.
4. Conversion from an approved candidate into the existing participant workflow.
5. A **Source participants for me** request with audience, sample, timing, incentive, and budget approval.
6. Manual Meridian recruitment operations represented through campaign events and costs.
7. Funnel, quota, cost, and quality reporting.

This release lets Meridian sell an end-to-end outcome while learning what should be automated. Panel APIs, advertising APIs, automated incentives, and a reusable Meridian panel should follow observed operational evidence rather than precede it.
