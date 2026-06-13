/* ============================================================
   Control library + the active client's assessments.

   - Official skeleton: GENERATED_CONTROLS (all 110 NIST SP 800-171 Rev. 2
     requirements, built from data-sources/sp800-171r2.json).
   - BF_OVERLAY: Benchmark Fox-authored plain-English explanations, common
     mistakes, evidence examples, implementation/interview guidance, and
     SSP/POA&M guidance for ALL 110 controls. This is authored overlay
     content — it is kept strictly separate from the official requirement
     text and the official NIST SP 800-171A objective text, and it never
     rewrites them. Validated by scripts/validate-benchmarkfox-guidance.mjs
     (npm run validate:guidance).
   - SEED_ASSESSMENTS: a default (Not Reviewed) assessment for every control,
     overlaid with a realistic worked subset for the active client.

   Official SPRS scoring comes from
   data-sources/dod-assessment-methodology-scoring.json (DoD Assessment
   Methodology v1.2.1, Annex A): the generator loads each control's official
   sprsDeductionValue into the generated library. 3.12.4 is "NA" (System Security
   Plan; not point-scored), so its scoreValue is null / deduction 0 by design.
   ============================================================ */
import type {
  ClientControlAssessment,
  Control,
  EvidenceStatus,
  Owner,
  PoamStatus,
  ReadinessStatus,
  RiskLevel,
  SspStatus,
} from './types';
import { DEMO_CLIENT_ID } from './clients';
import { CONTROL_FAMILIES } from './controlFamilies';
import { GENERATED_CONTROLS } from './generated/controls.generated';

/* ---- Benchmark Fox authored overlay (all 110 controls) ---- */
type Overlay = Partial<
  Pick<
    Control,
    'explanation' | 'commonMistakes' | 'evidenceExamples' | 'guidance' | 'sspGuidance' | 'poamGuidance'
  >
>;

/* NOTE: the object literal below is intentionally written as STRICT JSON
   (double-quoted keys/strings, no trailing comma, no comments inside) so that
   scripts/validate-benchmarkfox-guidance.mjs can extract and JSON.parse it.
   Keep it that way when editing. Bracketed values like [identity provider]
   are client-fillable variables, not unauthored gaps. */
const BF_OVERLAY: Record<string, Overlay> = {
  "3.1.1": {
    "explanation": "Only approved users, service accounts, and devices should be able to reach systems that store, process, or transmit CUI. You should be able to name every person, process, and device that is allowed in — and everything else is denied by default.",
    "commonMistakes": [
      "Shared or generic admin accounts that hide who is really signing in",
      "No authorized-device list, so personal or unknown devices can reach CUI systems",
      "Stale accounts left enabled after employees leave"
    ],
    "evidenceExamples": [
      "[identity provider] user and security group export",
      "Device compliance or authorized-device inventory from [MDM solution]",
      "Most recent account access review records"
    ],
    "guidance": {
      "implementation": "Tie all CUI system access to named accounts in [identity provider], scope access with security groups, and use device compliance policies so only enrolled, authorized devices can connect.",
      "interview": "“How does a new employee get access to CUI systems, and how do you know which devices are allowed to connect?”"
    },
    "sspGuidance": "State that access to CUI systems is limited to authorized users, processes, and devices. Name where this is enforced ([identity provider] named accounts, security groups, device compliance in [MDM solution]), who owns account and device approval (e.g., IT Lead), how it is enforced (conditional access, deny-by-default), how often access is reviewed (e.g., quarterly), and the evidence that supports it (user/group exports, device inventory, review records).",
    "poamGuidance": "Likely gap: shared accounts or no control over which devices connect. Remediation: migrate to named accounts in [identity provider], build an authorized-device list, and disable stale accounts. Owner: typically the IT Lead or [MSP/MSSP]. Milestone: all CUI access tied to named users and enrolled devices by a set date. Validation evidence: account/device exports plus a completed access review. Caution: this is a 5-point SPRS requirement and a foundational control — treat an open gap here as a likely assessment blocker and close it before assessment."
  },
  "3.1.2": {
    "explanation": "Once someone is in, they should only be able to do what their job requires. A shop-floor user should not be able to change firewall rules or export the entire CUI library.",
    "commonMistakes": [
      "Everyone runs as a local administrator",
      "Permissions granted ad hoc for one task and never removed",
      "No documented mapping of roles to the functions they may perform"
    ],
    "evidenceExamples": [
      "Role-to-permission matrix approved by management",
      "[identity provider] group membership export showing role groups",
      "Local administrator rights audit report"
    ],
    "guidance": {
      "implementation": "Define job roles in [identity provider], map each role to the minimum transactions and functions it needs, remove standing local admin rights, and gate privileged functions behind separate admin roles.",
      "interview": "“If I looked at an average user account right now, what could it do that the person's job does not require?”"
    },
    "sspGuidance": "Describe the role-based access model: which roles exist, where permissions are enforced ([identity provider] groups, application roles, file permissions), who approves role assignments (e.g., IT Lead with manager sign-off), how violations are prevented technically, how often access is re-reviewed (e.g., quarterly), and the supporting evidence (role matrix, group exports, review records).",
    "poamGuidance": "Likely gap: broad permissions and widespread admin rights. Remediation: build a role/permission matrix, regroup users in [identity provider], and strip rights that are not needed. Owner: typically the IT Lead. Milestone: all CUI-system users mapped to defined roles by a set date. Validation evidence: before/after permission exports and the approved role matrix. Caution: this is a 5-point SPRS requirement — plan to close it before assessment rather than relying on a POA&M."
  },
  "3.1.3": {
    "explanation": "Decide where CUI is allowed to live and move — between systems, networks, and people — and enforce those approved paths so CUI cannot wander into personal email, unmanaged cloud apps, or other unapproved places.",
    "commonMistakes": [
      "No documented CUI data flow diagram",
      "Unrestricted outbound traffic from the [CUI enclave]",
      "Staff forwarding CUI to personal accounts because nothing technically stops them"
    ],
    "evidenceExamples": [
      "CUI data flow diagram showing approved paths",
      "[firewall platform] egress rule export",
      "DLP or sharing-restriction policy from [cloud environment]"
    ],
    "guidance": {
      "implementation": "Document the approved CUI flows first, then enforce them with [firewall platform] egress rules, DLP policies, and external-sharing restrictions in [cloud environment].",
      "interview": "“Walk me through how a CUI file moves from your customer to your engineers — what stops it from leaving that path?”"
    },
    "sspGuidance": "State which CUI flows are approved (between which systems, networks, and partners), where the flow is enforced (firewall egress rules, DLP policies, sharing restrictions), who owns flow approvals (e.g., CIO or IT Lead), how often the data flow diagram is reviewed (e.g., annually and on change), and the evidence (diagram, rule exports, DLP policy).",
    "poamGuidance": "Likely gap: CUI flow is undocumented and unenforced. Remediation: author the data flow diagram, then implement egress and sharing controls to match it. Owner: IT Lead or [MSP/MSSP]. Milestone: approved flows documented and technically enforced by a set date. Validation evidence: the diagram plus rule exports and a test showing a blocked unapproved path. A 1-point SPRS requirement — lower score impact, but assessors will expect a clear CUI flow story."
  },
  "3.1.4": {
    "explanation": "Split high-risk responsibilities so no single person can both make and approve a sensitive action. The person who creates accounts should not also approve access requests; the person who changes systems should not be the only one who reviews those changes.",
    "commonMistakes": [
      "One administrator does everything with no second set of eyes",
      "No documented separation-of-duties matrix",
      "The same person performs an action and audits it"
    ],
    "evidenceExamples": [
      "Separation-of-duties matrix",
      "Approval workflow records in [ticketing system] showing different requester and approver",
      "Distinct admin role assignments in [identity provider]"
    ],
    "guidance": {
      "implementation": "List the sensitive duties (access approval, change approval, audit review, payments), assign them to different people, and where the team is too small, document compensating reviews by management.",
      "interview": "“Who approves an access request — and can that same person also create the account?”"
    },
    "sspGuidance": "Identify the duties that are separated and who holds each, where separation is enforced (role assignments in [identity provider], approval steps in [ticketing system]), who owns the matrix (e.g., CIO), how often it is reviewed (e.g., annually and on staffing changes), and the evidence (matrix, workflow approval logs). Small teams should document compensating management review where full separation is impractical.",
    "poamGuidance": "Likely gap: duties concentrated in a single admin. Remediation: define the separation-of-duties matrix and add second-person approval or a documented compensating review. Owner: CIO or equivalent. Milestone: matrix approved and workflows updated by a set date. Validation evidence: workflow logs showing dual control on a real request. A 1-point SPRS requirement, but it also underpins fraud and insider-risk arguments assessors care about."
  },
  "3.1.5": {
    "explanation": "Give every account — especially admin accounts — only the access it needs and nothing more. Privileged rights should be rare, specific, and reviewed; security functions should require privileged accounts.",
    "commonMistakes": [
      "Day-to-day work done on domain-admin level accounts",
      "Vendor and service accounts with standing full access",
      "Privileged group membership never reviewed"
    ],
    "evidenceExamples": [
      "Privileged account inventory",
      "[identity provider] privileged role/group membership export",
      "Most recent privileged access review record"
    ],
    "guidance": {
      "implementation": "Inventory privileged accounts, move admins to separate admin-only accounts, scope rights to specific duties, and use just-in-time elevation in [identity provider] where available.",
      "interview": "“How many people hold global or domain admin rights today, and when were those rights last reviewed?”"
    },
    "sspGuidance": "Describe the least-privilege policy: how privileged roles are defined and assigned, where it is enforced ([identity provider] roles, just-in-time elevation, scoped admin groups), who owns privileged access approvals (e.g., IT Lead), the review cadence for privileged accounts (e.g., quarterly), and the evidence (privileged account inventory, review records, role exports).",
    "poamGuidance": "Likely gap: more privileged rights than the mission needs. Remediation: inventory privileged accounts, remove unneeded rights, and separate admin from daily-use accounts. Owner: IT Lead. Milestone: privileged accounts reduced to an approved list by a set date. Validation evidence: privileged role export plus a completed review record. Caution: a 3-point SPRS requirement — close it before assessment where practical."
  },
  "3.1.6": {
    "explanation": "Admins should use a normal user account for email, browsing, and documents, and switch to a separate admin account only when doing admin work. This keeps everyday phishing and malware away from privileged rights.",
    "commonMistakes": [
      "Reading email while signed in with a privileged account",
      "One account doubles as both user and admin",
      "No technical block on admin accounts using email or the web"
    ],
    "evidenceExamples": [
      "Account export showing separate admin accounts (e.g., adm- naming convention)",
      "Policy requiring non-privileged accounts for nonsecurity functions",
      "Conditional access rules in [identity provider] restricting admin accounts from mail/web"
    ],
    "guidance": {
      "implementation": "Issue each administrator two accounts — a standard account for daily work and an admin account without a mailbox — and block the admin account from email and web apps in [identity provider].",
      "interview": "“Show me the account you used to read email this morning — does it hold admin rights anywhere?”"
    },
    "sspGuidance": "State that administrators use non-privileged accounts for nonsecurity functions, where this is enforced (separate admin accounts in [identity provider], no mailbox on admin accounts, conditional access restrictions), who owns the dual-account standard (e.g., IT Lead), how compliance is checked (e.g., quarterly account audit), and the evidence (account exports, policy, restriction configs).",
    "poamGuidance": "Likely gap: admins doing daily work on privileged accounts. Remediation: create separate admin accounts, strip mailboxes/licenses from them, and restrict their use to admin tasks. Owner: IT Lead. Milestone: all admins migrated to dual accounts by a set date. Validation evidence: account export showing the split and restriction policies. A 1-point SPRS requirement that is usually quick to close."
  },
  "3.1.7": {
    "explanation": "Ordinary users must not be able to run privileged actions — install drivers, change security settings, disable protections — and every execution of a privileged function should land in the audit logs.",
    "commonMistakes": [
      "Standard users hold local admin rights, making every privileged function available",
      "Privileged activity is not logged anywhere",
      "Elevation prompts disabled for convenience"
    ],
    "evidenceExamples": [
      "Local admin removal report from [endpoint management platform]",
      "Audit policy showing privileged-function logging enabled",
      "Sample log of an elevation or blocked privileged action from [SIEM/logging platform]"
    ],
    "guidance": {
      "implementation": "Remove local admin from standard users via [endpoint management platform], require elevation with separate admin credentials, and forward privileged-activity audit events to [SIEM/logging platform].",
      "interview": "“If a regular user tried to disable the antivirus, what would happen — and where would that attempt be recorded?”"
    },
    "sspGuidance": "Describe how non-privileged users are technically prevented from executing privileged functions (no local admin, UAC/elevation controls, application restrictions), where privileged executions are captured (audit policy forwarding to [SIEM/logging platform]), who owns the configuration (e.g., IT Lead or [MSP/MSSP]), how often logs and rights are reviewed, and the evidence (rights report, audit policy, sample events).",
    "poamGuidance": "Likely gap: standard users still hold local admin and privileged actions are not logged. Remediation: strip local admin rights and enable privileged-function auditing. Owner: IT Lead or [MSP/MSSP]. Milestone: rights removed and logging verified on all endpoints by a set date. Validation evidence: endpoint rights report plus sample audit events. A 1-point SPRS requirement, but it directly supports your audit and incident-response story."
  },
  "3.1.8": {
    "explanation": "Lock or slow down accounts after a handful of failed sign-in attempts so attackers cannot guess passwords indefinitely. The limit has to exist on every entry point — not just Windows.",
    "commonMistakes": [
      "Lockout configured on the domain but not on cloud apps or the VPN",
      "Thresholds set so high they never trigger",
      "No lockout on remote portals exposed to the internet"
    ],
    "evidenceExamples": [
      "Account lockout policy export from [identity provider] or group policy",
      "Smart lockout / failed-attempt settings for cloud sign-ins",
      "Test record showing a lockout actually occurs"
    ],
    "guidance": {
      "implementation": "Set a lockout threshold (commonly 5–10 attempts) with a defined lockout duration in [identity provider], and verify the same protection exists on the VPN and any externally reachable portal.",
      "interview": "“What happens after the fifth wrong password on your VPN?”"
    },
    "sspGuidance": "State the failed-attempt threshold and lockout behavior (duration or admin unlock), every place it is enforced ([identity provider], OS policy, VPN, remote portals), who owns the setting (e.g., IT Lead), how often it is verified, and the evidence (policy exports and a documented lockout test).",
    "poamGuidance": "Likely gap: lockout missing or inconsistent across entry points. Remediation: configure lockout in [identity provider], OS policy, and the VPN. Owner: IT Lead. Milestone: consistent lockout live on all entry points by a set date. Validation evidence: config exports plus a recorded lockout test. A 1-point SPRS requirement and typically a same-week fix."
  },
  "3.1.9": {
    "explanation": "Show a sign-in notice telling users the system is monitored and subject to CUI handling rules, so continued use means informed consent to those rules.",
    "commonMistakes": [
      "Banner on Windows logon but not on the VPN or cloud apps",
      "Generic text that never mentions monitoring or CUI",
      "Banner wording never approved by leadership"
    ],
    "evidenceExamples": [
      "Screenshot of the sign-in banner",
      "Group policy or [MDM solution] banner configuration export",
      "Approved banner wording on file"
    ],
    "guidance": {
      "implementation": "Approve standard banner wording that covers monitoring and CUI rules, then deploy it via group policy or [MDM solution] on endpoints and on remote access portals.",
      "interview": "“What does a user see before signing in to a CUI system?”"
    },
    "sspGuidance": "Quote or reference the approved banner wording, list where it is displayed (workstation logon, VPN, web portals), who owns the wording (e.g., CIO), how often it is reviewed (e.g., annually), and the evidence (screenshots and the deployment configuration).",
    "poamGuidance": "Likely gap: no banner, or banners missing from remote entry points. Remediation: approve wording and deploy via group policy/[MDM solution] and portal settings. Owner: IT Lead. Milestone: banner displayed on all CUI entry points by a set date. Validation evidence: screenshots from each entry point. A 1-point SPRS requirement and one of the cheapest fixes on the list."
  },
  "3.1.10": {
    "explanation": "Screens must lock automatically after a period of inactivity — and on demand — hiding whatever was displayed until the user signs back in.",
    "commonMistakes": [
      "Timeout set too long or left to user preference",
      "Shared or shop-floor PCs exempted and never locking",
      "Users able to disable the screen lock"
    ],
    "evidenceExamples": [
      "Group policy or [MDM solution] screen lock policy export",
      "Screenshot of a locked, pattern-hidden screen",
      "Spot-check record of workstations locking on schedule"
    ],
    "guidance": {
      "implementation": "Enforce a 10–15 minute inactivity lock with a pattern-hiding lock screen through [endpoint management platform], and train users to lock manually when stepping away.",
      "interview": "“How long does a workstation sit idle before it locks — and can the user turn that off?”"
    },
    "sspGuidance": "State the inactivity timeout and that the lock conceals previously displayed information, where it is enforced ([endpoint management platform] policy on all endpoints including shared PCs), who owns the policy, how compliance is verified (policy reports, spot checks), and the evidence (policy export, screenshots).",
    "poamGuidance": "Likely gap: locks unenforced or inconsistent. Remediation: deploy an enforced lock policy to every endpoint, including shared and shop-floor machines. Owner: IT Lead. Milestone: policy enforced fleet-wide by a set date. Validation evidence: policy compliance report. A 1-point SPRS requirement."
  },
  "3.1.11": {
    "explanation": "User sessions should actually end — not just lock — when a defined condition is met, such as extended inactivity or end of a remote session. Sessions that live forever are sessions that can be stolen.",
    "commonMistakes": [
      "Cloud sessions persist for weeks with no re-authentication",
      "Confusing screen lock with session termination",
      "VPN and remote desktop sessions never expire"
    ],
    "evidenceExamples": [
      "Sign-in frequency / session lifetime settings in [identity provider]",
      "VPN and remote desktop idle disconnect configuration",
      "Session policy documentation"
    ],
    "guidance": {
      "implementation": "Define the terminating conditions (e.g., idle time, maximum session length), then configure sign-in frequency in [identity provider] and idle disconnects on the VPN and remote desktop services.",
      "interview": "“When does a remote session actually end — not just lock — without the user doing anything?”"
    },
    "sspGuidance": "Define the conditions that terminate a session (inactivity period, maximum duration, disconnect events), where each is enforced ([identity provider] session policy, VPN/RDP timeouts), who owns the settings, how often they are reviewed, and the evidence (configuration exports).",
    "poamGuidance": "Likely gap: sessions never terminate automatically. Remediation: set session lifetime and idle disconnect policies across [identity provider], VPN, and remote desktop. Owner: IT Lead. Milestone: termination conditions enforced by a set date. Validation evidence: configuration exports and an observed timeout. A 1-point SPRS requirement."
  },
  "3.1.12": {
    "explanation": "Every way into your environment from outside — VPN, remote desktop tools, vendor support access — must be approved, restricted, and watched. Remote access you did not authorize or cannot see is how most small contractors get breached.",
    "commonMistakes": [
      "Unmanaged remote-control tools installed ad hoc by users or vendors",
      "Vendor remote access with no tracking or expiration",
      "Remote sessions not logged anywhere"
    ],
    "evidenceExamples": [
      "Approved remote access methods list",
      "[VPN/remote access solution] configuration and session logs",
      "Conditional access policy in [identity provider] governing remote sessions"
    ],
    "guidance": {
      "implementation": "Consolidate remote access to the approved [VPN/remote access solution], require MFA, log all sessions to [SIEM/logging platform], and block unapproved remote-control tools at the endpoint and firewall.",
      "interview": "“List every way someone can reach your network remotely today — who approved each one?”"
    },
    "sspGuidance": "List the authorized remote access methods and prohibit all others, where control is enforced ([VPN/remote access solution], conditional access, endpoint blocks on rogue tools), how sessions are monitored ([SIEM/logging platform]), who owns remote access approvals (e.g., IT Lead), the review cadence for remote access rules and logs, and the evidence (method list, configs, session logs).",
    "poamGuidance": "Likely gap: multiple unmanaged remote access paths. Remediation: consolidate onto one approved, MFA-protected method, enable session logging, and remove rogue tools. Owner: IT Lead or [MSP/MSSP]. Milestone: a single controlled remote access path enforced by a set date. Validation evidence: configuration plus session logs and proof that legacy tools are blocked. Caution: this is a 5-point SPRS requirement and a common attack vector — treat it as a pre-assessment fix, not a deferral."
  },
  "3.1.13": {
    "explanation": "Remote access sessions must be encrypted with cryptography you can defend — for CUI that means FIPS-validated modules — so session traffic cannot be read in transit.",
    "commonMistakes": [
      "Legacy VPN protocols or weak ciphers still accepted",
      "Remote desktop exposed directly without a TLS/VPN wrapper",
      "FIPS mode assumed but never enabled or verified"
    ],
    "evidenceExamples": [
      "[VPN/remote access solution] cipher/protocol configuration export",
      "FIPS 140 validation certificate number for the crypto module in use",
      "Vendor documentation confirming the validated module"
    ],
    "guidance": {
      "implementation": "Configure [VPN/remote access solution] to use FIPS-validated cryptographic modules, disable legacy protocols and ciphers, and record the CMVP certificate numbers you rely on.",
      "interview": "“What encryption protects a remote session, and can you point to its FIPS 140 validation?”"
    },
    "sspGuidance": "State that remote access confidentiality is protected with cryptographic mechanisms, name the solution and the validated module ([VPN/remote access solution], CMVP certificate number), who owns the configuration, how often cipher settings are reviewed, and the evidence (config export, certificate reference). Cross-reference your FIPS position under 3.13.11.",
    "poamGuidance": "Likely gap: remote sessions encrypted with unvalidated or legacy cryptography. Remediation: enable FIPS-validated modules on the remote access stack and retire weak protocols. Owner: IT Lead or [MSP/MSSP]. Milestone: validated configuration live by a set date. Validation evidence: configuration export plus the CMVP certificate reference. Caution: a 5-point SPRS requirement tied to the FIPS story assessors check closely — close before assessment."
  },
  "3.1.14": {
    "explanation": "Funnel all remote access through a small number of managed gateways — your VPN concentrator or secure access service — instead of letting individual systems be reachable directly from the internet.",
    "commonMistakes": [
      "Port-forwarded remote desktop straight to individual machines",
      "Several ad hoc entry points accumulated over the years",
      "No inventory of what is reachable from outside"
    ],
    "evidenceExamples": [
      "Network diagram showing the managed access control points",
      "[firewall platform] rules limiting inbound access to the gateway only",
      "External exposure scan showing no direct host access"
    ],
    "guidance": {
      "implementation": "Route all remote access through [VPN/remote access solution], remove port forwards to individual hosts, and verify with an external scan that only the managed gateways answer.",
      "interview": "“How many doors are there into your network from the internet, and where are they?”"
    },
    "sspGuidance": "Identify each managed access control point (gateway, concentrator, secure access service), state that all remote access routes through them, where this is enforced ([firewall platform] inbound rules), who owns gateway configuration, how often exposure is re-verified (e.g., quarterly external scan), and the evidence (diagram, rules, scan results).",
    "poamGuidance": "Likely gap: direct inbound access to individual systems. Remediation: eliminate port forwards, route everything through the managed gateway, and confirm with an external scan. Owner: IT Lead or [MSP/MSSP]. Milestone: only managed access points exposed by a set date. Validation evidence: firewall rule export plus a clean external scan. A 1-point SPRS requirement with outsized real-world risk reduction."
  },
  "3.1.15": {
    "explanation": "Decide in advance who may run privileged commands remotely and who may reach security-relevant information from outside, and write that authorization down. Remote admin should be a named-person exception, not the norm.",
    "commonMistakes": [
      "All admins can do everything remotely by default",
      "No record of who authorized remote privileged access",
      "Vendors running privileged commands remotely without supervision or logging"
    ],
    "evidenceExamples": [
      "Authorized remote-admin list with management approval",
      "Privileged access workstation or jump-host configuration",
      "Approval records in [ticketing system] for remote privileged sessions"
    ],
    "guidance": {
      "implementation": "Restrict remote privileged work to named administrators through a jump host or privileged access path, require MFA, and capture authorizations in [ticketing system].",
      "interview": "“Who is allowed to make admin changes from outside the office, and where is that authorization written?”"
    },
    "sspGuidance": "List which privileged commands and security-relevant information may be accessed remotely and by whom, where it is enforced (jump host, conditional access, role restrictions), who grants the authorization (e.g., CIO), the review cadence of the authorized list, and the evidence (authorization records, session logs).",
    "poamGuidance": "Likely gap: remote privileged access is implicit and unrecorded. Remediation: define the authorized list, route remote admin through a controlled path, and document approvals. Owner: IT Lead. Milestone: authorization list approved and enforced by a set date. Validation evidence: the approved list plus session logs. A 1-point SPRS requirement."
  },
  "3.1.16": {
    "explanation": "Wireless networks — and the devices allowed on them — must be explicitly authorized before they connect. Guest Wi-Fi must never be able to touch the CUI environment.",
    "commonMistakes": [
      "Guest and corporate Wi-Fi on the same network segment",
      "Unknown personal devices joining the corporate SSID",
      "Rogue access points stood up by staff and never detected"
    ],
    "evidenceExamples": [
      "Wireless network inventory with written authorization",
      "[wireless controller] configuration showing SSIDs and segmentation",
      "Rogue access point scan results"
    ],
    "guidance": {
      "implementation": "Authorize each SSID in writing, require certificate or 802.1X authentication for corporate wireless via [wireless controller], segment guest Wi-Fi away from the [CUI enclave], and scan periodically for rogue access points.",
      "interview": "“Can a personal phone on your Wi-Fi reach anything that touches CUI?”"
    },
    "sspGuidance": "List the authorized wireless networks and their purpose, how devices are authorized before connecting (802.1X, certificates, MDM enrollment), where guest traffic is isolated, who owns wireless authorization (e.g., IT Lead), the review cadence (config review, rogue AP scans), and the evidence (inventory, controller config, scan results).",
    "poamGuidance": "Likely gap: unauthorized or unsegmented wireless access. Remediation: authorize SSIDs, enforce 802.1X/certificate auth, and segment guest Wi-Fi from CUI systems. Owner: IT Lead or [MSP/MSSP]. Milestone: authorized, segmented wireless live by a set date. Validation evidence: controller config, segmentation test, rogue AP scan. Caution: a 5-point SPRS requirement — close before assessment; wireless gaps are easy for assessors to spot-check."
  },
  "3.1.17": {
    "explanation": "Corporate Wi-Fi must require strong authentication and modern encryption — WPA2-Enterprise or WPA3 with per-user credentials — not one shared password that never changes.",
    "commonMistakes": [
      "A shared pre-shared key unchanged for years and known to ex-employees",
      "Legacy WEP/WPA or open SSIDs still broadcasting",
      "The corporate Wi-Fi password handed out to visitors"
    ],
    "evidenceExamples": [
      "[wireless controller] encryption and authentication configuration export",
      "802.1X/RADIUS configuration tied to [identity provider]",
      "Wireless security survey results"
    ],
    "guidance": {
      "implementation": "Move corporate wireless to WPA2/WPA3-Enterprise with 802.1X authentication against [identity provider] or RADIUS, and retire shared-key and legacy SSIDs.",
      "interview": "“What does it take to join your corporate wireless — a shared password, or a per-user credential?”"
    },
    "sspGuidance": "State the wireless authentication method (802.1X/certificates) and encryption standard (WPA2-Enterprise/WPA3), where it is enforced ([wireless controller], RADIUS/[identity provider]), who owns wireless security, how often configuration is reviewed, and the evidence (controller export, RADIUS config).",
    "poamGuidance": "Likely gap: shared-key wireless protecting access to systems that handle CUI. Remediation: deploy 802.1X/WPA-Enterprise and retire the shared key. Owner: IT Lead or [MSP/MSSP]. Milestone: enterprise wireless auth live by a set date. Validation evidence: controller configuration plus a connection test showing per-user auth. Caution: a 5-point SPRS requirement — treat as a pre-assessment fix."
  },
  "3.1.18": {
    "explanation": "Phones and tablets that connect to company systems must be enrolled, managed, and restricted. You decide which mobile devices may connect, and you keep the ability to wipe company data off them.",
    "commonMistakes": [
      "Personal phones syncing company email with no management at all",
      "No mobile device management platform deployed",
      "No way to wipe a lost or stolen device"
    ],
    "evidenceExamples": [
      "[MDM solution] enrollment and compliance report",
      "Mobile device policy",
      "Conditional access policy requiring compliant devices for mail/app access"
    ],
    "guidance": {
      "implementation": "Require [MDM solution] enrollment and compliance before any mobile device can reach company email or apps, enforced through [identity provider] conditional access; configure remote wipe for company data.",
      "interview": "“If an employee's phone with company email on it is stolen tonight, what can you actually do about it?”"
    },
    "sspGuidance": "State which mobile devices may connect and under what conditions (enrollment, compliance, encryption), where it is enforced ([MDM solution] plus conditional access in [identity provider]), who owns mobile device approval, the review cadence (enrollment/compliance reports), and the evidence (MDM reports, policy, conditional access export).",
    "poamGuidance": "Likely gap: unmanaged mobile devices accessing company data. Remediation: deploy [MDM solution], require enrollment for access, and enable remote wipe. Owner: IT Lead. Milestone: conditional access blocking unmanaged devices by a set date. Validation evidence: MDM compliance report plus a blocked-access test from an unenrolled device. Caution: a 5-point SPRS requirement — plan to close before assessment."
  },
  "3.1.19": {
    "explanation": "Any CUI on a phone, tablet, or laptop that leaves the building must be encrypted, so a lost device is an inconvenience instead of a reportable incident.",
    "commonMistakes": [
      "Assuming a device PIN is the same as encryption",
      "Laptops without verified full-disk encryption",
      "No reporting that shows encryption status across the fleet"
    ],
    "evidenceExamples": [
      "[MDM solution] / [endpoint management platform] encryption compliance report",
      "Full-disk encryption policy export",
      "Sample device record showing encryption enabled"
    ],
    "guidance": {
      "implementation": "Enforce device encryption (full-disk on laptops, platform encryption on mobile) through [MDM solution] and [endpoint management platform], and block unencrypted devices from CUI access.",
      "interview": "“How do you know every laptop that could hold CUI is actually encrypted right now?”"
    },
    "sspGuidance": "State that CUI on mobile devices and platforms is encrypted, name the mechanism and scope (full-disk encryption on laptops, enforced encryption on phones/tablets via [MDM solution]), who owns encryption policy, how compliance is verified (recurring compliance reports), and the evidence (compliance report, policy export). Note the FIPS-validated module used, cross-referencing 3.13.11.",
    "poamGuidance": "Likely gap: unencrypted or unverified mobile devices. Remediation: enforce encryption via [MDM solution]/[endpoint management platform] and remediate non-compliant devices. Owner: IT Lead. Milestone: 100% of in-scope devices reporting encrypted by a set date. Validation evidence: fleet compliance report. Caution: a 3-point SPRS requirement — close before assessment where practical."
  },
  "3.1.20": {
    "explanation": "Control which outside systems — partner networks, personal devices, public cloud services — may connect to yours or carry your CUI, and verify their safeguards before you trust them.",
    "commonMistakes": [
      "Staff using personal cloud storage for work files",
      "No list of approved external systems and services",
      "Partner connections with no agreement covering security expectations"
    ],
    "evidenceExamples": [
      "Approved external systems/services list",
      "Cloud app control or web filtering policy export",
      "Agreements or contract clauses covering external connections"
    ],
    "guidance": {
      "implementation": "Define the approved external systems and cloud services, block unsanctioned ones with [cloud access/web filtering solution], and put security expectations for partner connections in writing.",
      "interview": "“Could an employee put CUI in a personal cloud drive right now — what stops them?”"
    },
    "sspGuidance": "List the approved external systems/services and the conditions of use, how unapproved ones are limited (technical blocks, policy), who approves external connections (e.g., CIO), how often the approved list is reviewed, and the evidence (approved list, blocking policy export, agreements).",
    "poamGuidance": "Likely gap: unrestricted use of external systems and personal cloud services. Remediation: publish the approved list, deploy technical blocking, and formalize partner connection agreements. Owner: IT Lead with management sign-off. Milestone: approved list enforced by a set date. Validation evidence: blocking policy plus a test showing an unsanctioned service denied. A 1-point SPRS requirement."
  },
  "3.1.21": {
    "explanation": "Limit when company portable storage — USB drives, external disks — can be plugged into systems you do not control, like home computers or hotel kiosks.",
    "commonMistakes": [
      "No policy on using company drives in outside machines",
      "Unencrypted USB drives floating between home and office",
      "No inventory of company-issued portable storage"
    ],
    "evidenceExamples": [
      "Removable media / portable storage policy",
      "Inventory of issued encrypted drives",
      "Device control configuration limiting which drives work where"
    ],
    "guidance": {
      "implementation": "Prohibit or tightly restrict company portable storage on external systems by policy, issue only encrypted drives, and use device control in [endpoint management platform] so unknown systems cannot be a quiet side channel.",
      "interview": "“Can someone plug a company USB drive into a hotel business-center PC — and would you ever know?”"
    },
    "sspGuidance": "State the policy on portable storage used on external systems (prohibited, or limited to defined cases with encrypted, inventoried drives), how it is enforced (policy, encrypted-drive standard, device control), who owns it, the review cadence, and the evidence (policy, drive inventory, device control config).",
    "poamGuidance": "Likely gap: no limits on portable storage outside the company. Remediation: adopt the policy, issue encrypted inventoried drives, and train users. Owner: IT Lead. Milestone: policy live and drives inventoried by a set date. Validation evidence: signed policy plus the inventory. A 1-point SPRS requirement."
  },
  "3.1.22": {
    "explanation": "Make sure nothing posted publicly — your website, social media, marketing material, job postings — ever contains CUI. Someone specific must review content before it goes public.",
    "commonMistakes": [
      "No pre-publication review step at all",
      "Engineers posting project details that reveal controlled information",
      "Old public files never re-checked after rules change"
    ],
    "evidenceExamples": [
      "Pre-publication review procedure",
      "Review/approval records for recent public posts",
      "Designated reviewer assignment in writing"
    ],
    "guidance": {
      "implementation": "Designate trained reviewers, require their sign-off in [ticketing system] before anything is posted publicly, and sweep existing public content periodically for CUI.",
      "interview": "“Who checks a blog post or brochure for CUI before it goes public?”"
    },
    "sspGuidance": "Name the roles authorized to post publicly and the reviewer who checks for CUI, where the review is recorded ([ticketing system] or review log), who owns the procedure, the cadence of periodic sweeps of existing public content, and the evidence (procedure, review records).",
    "poamGuidance": "Likely gap: no controlled review before public posting. Remediation: designate and train reviewers, add the approval step, and sweep current public content. Owner: communications lead with CIO support. Milestone: review process operating by a set date. Validation evidence: completed review records. A 1-point SPRS requirement."
  },
  "3.2.1": {
    "explanation": "Everyone with system access — including managers and executives — needs regular training on security risks and the rules for handling CUI, so day-to-day choices do not undo your technical controls.",
    "commonMistakes": [
      "Training delivered once at hire and never refreshed",
      "Generic content with nothing about CUI handling",
      "Completion not tracked, so nobody can prove who was trained"
    ],
    "evidenceExamples": [
      "Training content or slide deck covering CUI handling",
      "Completion report from [LMS/training platform]",
      "Annual training schedule and policy"
    ],
    "guidance": {
      "implementation": "Run security awareness training at onboarding and at least annually through [LMS/training platform], include CUI-specific handling content, and track completion for every user including leadership.",
      "interview": "“When did your newest hire and your CEO last complete security training, and what did it cover?”"
    },
    "sspGuidance": "Describe the awareness program: what is covered (security risks, policies, CUI handling), who must take it (all users including executives), where it is delivered ([LMS/training platform]), who owns it (e.g., HR with IT), the cadence (onboarding plus annual refresh), and the evidence (content, completion reports, schedule).",
    "poamGuidance": "Likely gap: no recurring, tracked awareness training. Remediation: stand up a training program in [LMS/training platform] with CUI content and completion tracking. Owner: HR / IT jointly. Milestone: all current users trained by a set date, then annual cycle. Validation evidence: completion report covering 100% of users. Caution: a 5-point SPRS requirement — close it before assessment; it is also among the easiest 5-point items to fix."
  },
  "3.2.2": {
    "explanation": "People with security-relevant duties — admins, HR staff handling personnel actions, anyone managing CUI media — need training specific to those duties, beyond the general awareness course.",
    "commonMistakes": [
      "Admins never trained on secure administration practices",
      "Security-relevant roles never identified in the first place",
      "The same generic course assigned to every role"
    ],
    "evidenceExamples": [
      "Role-to-training matrix",
      "Role-specific training records or certificates for admins",
      "Completion records from [LMS/training platform]"
    ],
    "guidance": {
      "implementation": "Identify the roles with security-relevant duties, define what each must be trained on, and assign role-specific modules or certifications tracked in [LMS/training platform].",
      "interview": "“What extra training does a system administrator get that the receptionist does not?”"
    },
    "sspGuidance": "List the security-relevant roles and the training assigned to each, where it is delivered and tracked ([LMS/training platform]), who owns the matrix (e.g., HR with the IT Lead), the cadence (before taking up duties, then periodic refresh), and the evidence (matrix, completion records).",
    "poamGuidance": "Likely gap: no role-based training beyond general awareness. Remediation: build the role-to-training matrix and assign role-specific content. Owner: HR / IT. Milestone: all security-relevant role holders trained by a set date. Validation evidence: matrix plus completion records. Caution: a 5-point SPRS requirement — prioritize closing before assessment."
  },
  "3.2.3": {
    "explanation": "Train staff to recognize and report insider-threat warning signs — unusual data hoarding, disgruntlement, probing questions about access — and make sure everyone knows where to report a concern.",
    "commonMistakes": [
      "No insider-threat content in any training",
      "No defined channel for reporting concerns",
      "Managers never trained on the indicators they are best placed to spot"
    ],
    "evidenceExamples": [
      "Insider threat training module content",
      "Completion records from [LMS/training platform]",
      "Documented reporting procedure"
    ],
    "guidance": {
      "implementation": "Add insider-threat indicators and reporting steps to the annual awareness training, and publish a clear reporting channel (named role or mailbox).",
      "interview": "“If a coworker started mass-copying project files at midnight, would your staff know what to do about it?”"
    },
    "sspGuidance": "State that insider-threat indicators and reporting are covered in training, where it is delivered ([LMS/training platform]), who owns the content, the reporting channel users are taught, the refresh cadence (annual), and the evidence (module content, completion records, reporting procedure).",
    "poamGuidance": "Likely gap: insider threat never addressed in training. Remediation: add the module and the reporting channel to the awareness program. Owner: HR / IT. Milestone: module live and current staff trained by a set date. Validation evidence: module content plus completion report. A 1-point SPRS requirement."
  },
  "3.3.1": {
    "explanation": "Systems must record who did what and when, and you must keep those logs long enough to investigate an incident months later. If the logs were never created or already rotated away, the investigation is over before it starts.",
    "commonMistakes": [
      "Logging left at defaults with no defined retention",
      "Key systems — firewall, file server, identity provider — never collected centrally",
      "Logs overwritten within days because storage was never sized"
    ],
    "evidenceExamples": [
      "Log source inventory listing every CUI system",
      "[SIEM/logging platform] retention configuration",
      "Sample log retrieved from months back"
    ],
    "guidance": {
      "implementation": "Centralize logs from every CUI-relevant system into [SIEM/logging platform], define retention that supports investigations (commonly one year), and check coverage against the system inventory.",
      "interview": "“If we found a problem from 90 days ago, could you produce the logs to investigate it?”"
    },
    "sspGuidance": "Describe what is logged and from which systems (per the log source inventory), where logs are collected and retained ([SIEM/logging platform], retention period), who owns logging (e.g., IT Lead or [MSP/MSSP]), how coverage and retention are reviewed (e.g., quarterly), and the evidence (inventory, retention config, sample retained events).",
    "poamGuidance": "Likely gap: logging is local, partial, and short-lived. Remediation: deploy or configure [SIEM/logging platform], onboard all CUI-relevant sources, and set retention. Owner: IT Lead or [MSP/MSSP]. Milestone: all sources onboarded with target retention by a set date. Validation evidence: source list in the platform plus retention config. Caution: a 5-point SPRS requirement that several other audit controls depend on — treat as a pre-assessment fix."
  },
  "3.3.2": {
    "explanation": "Logs must tie every action to a specific person — which is only possible if every account belongs to exactly one human and systems record who did what. Shared logins quietly destroy accountability.",
    "commonMistakes": [
      "Shared accounts that make attribution impossible",
      "Service accounts used interactively by staff",
      "Logs that record an event but not the user behind it"
    ],
    "evidenceExamples": [
      "Sample audit events showing user attribution",
      "Shared-account elimination or exception report",
      "Unique account policy"
    ],
    "guidance": {
      "implementation": "Eliminate shared logins, keep service accounts non-interactive, and verify that audit events in [SIEM/logging platform] carry the acting user's unique ID.",
      "interview": "“If a file was deleted yesterday, can you tell me exactly who did it?”"
    },
    "sspGuidance": "State that all actions are traceable to unique individual accounts, how that is ensured (no shared accounts, non-interactive service accounts, user IDs captured in events), where the records live ([SIEM/logging platform]), who owns account hygiene, the review cadence (account audits), and the evidence (sample attributed events, account audit results).",
    "poamGuidance": "Likely gap: shared accounts break traceability. Remediation: replace shared logins with named accounts and lock service accounts to non-interactive use. Owner: IT Lead. Milestone: shared accounts retired or formally excepted by a set date. Validation evidence: account audit plus attributed log samples. Caution: a 3-point SPRS requirement — close before assessment where practical."
  },
  "3.3.3": {
    "explanation": "Revisit which events you log on a schedule. As threats, systems, and investigations change, the set of events worth capturing changes too — a list written once in 2020 is stale.",
    "commonMistakes": [
      "The logged-event list has never been revisited",
      "Logging everything (drowning in noise) or almost nothing",
      "No documented rationale for what is captured"
    ],
    "evidenceExamples": [
      "Documented list of logged event types",
      "Periodic review record with date and reviewer",
      "Change history showing an update to logged events"
    ],
    "guidance": {
      "implementation": "Document the event types you capture and why, then review the list at least annually and after major system or threat changes, recording the outcome.",
      "interview": "“When did you last change what you log, and what prompted it?”"
    },
    "sspGuidance": "Reference the documented logged-events list, who reviews it (e.g., IT Lead with [MSP/MSSP] input), the review cadence (annually and on significant change), where updates are applied ([SIEM/logging platform] collection rules), and the evidence (the list, dated review records).",
    "poamGuidance": "Likely gap: no documented or reviewed event list. Remediation: write down the current event set and institute the periodic review. Owner: IT Lead. Milestone: documented list plus first review completed by a set date. Validation evidence: the list and review record. A 1-point SPRS requirement."
  },
  "3.3.4": {
    "explanation": "If logging breaks — disk full, agent dead, service stopped — the right people must be alerted quickly. A silent gap in your logs is a blind spot you will only discover during an incident, which is the worst possible time.",
    "commonMistakes": [
      "Log agent failures going unnoticed for weeks",
      "No defined recipients for logging-failure alerts",
      "Alerts routed to a mailbox nobody monitors"
    ],
    "evidenceExamples": [
      "Alert rule configuration in [SIEM/logging platform] for source silence or agent health",
      "Sample logging-failure alert and the response to it",
      "Escalation procedure naming recipients"
    ],
    "guidance": {
      "implementation": "Configure [SIEM/logging platform] to alert when a log source goes quiet or an agent fails, route alerts into [ticketing system], and name who responds.",
      "interview": "“How would you find out if your file server stopped sending logs?”"
    },
    "sspGuidance": "Describe how audit logging failures are detected (heartbeat/source-silence alerts in [SIEM/logging platform]), who is alerted and how fast, who owns the alert rules, how the alerting itself is tested or reviewed, and the evidence (rule config, a sample alert with response).",
    "poamGuidance": "Likely gap: logging failures are invisible. Remediation: enable source-health alerting and route it to named responders via [ticketing system]. Owner: IT Lead or [MSP/MSSP]. Milestone: alerting live for all critical sources by a set date. Validation evidence: rule config plus a test alert. A 1-point SPRS requirement."
  },
  "3.3.5": {
    "explanation": "Look across logs from different systems together — sign-ins plus VPN plus endpoint activity — so attack patterns that span systems get noticed, investigated, and reported instead of sitting in separate silos.",
    "commonMistakes": [
      "Logs collected but never actually analyzed",
      "Each system reviewed in isolation, so cross-system patterns are missed",
      "No defined process for investigating and reporting what analysis finds"
    ],
    "evidenceExamples": [
      "Correlation or analytic rules configured in [SIEM/logging platform]",
      "Investigation runbook or triage procedure",
      "A sample correlated alert with its investigation record"
    ],
    "guidance": {
      "implementation": "Enable correlation/analytic rules in [SIEM/logging platform] across identity, network, and endpoint sources, and define the triage workflow: who investigates, how findings are recorded, and when they escalate to incident response.",
      "interview": "“Give me an example where two different log sources together triggered an investigation.”"
    },
    "sspGuidance": "Describe the correlation and analysis process: which sources are correlated, where ([SIEM/logging platform] rules), who performs review and investigation (internal or [MSP/MSSP] SOC), the cadence (continuous alerting plus periodic review), how findings are reported, and the evidence (rule exports, investigation records).",
    "poamGuidance": "Likely gap: collection without correlation or response. Remediation: enable analytics across sources and stand up the triage process, possibly via an [MSP/MSSP] SOC. Owner: IT Lead or [MSP/MSSP]. Milestone: correlation rules live with a documented workflow by a set date. Validation evidence: rule export plus a worked investigation record. Caution: a 5-point SPRS requirement — plan to close before assessment."
  },
  "3.3.6": {
    "explanation": "You need tooling that can filter, search, and report across large volumes of logs on demand. Scrolling raw text files during an incident is not a plan.",
    "commonMistakes": [
      "Raw logs with no search or reporting capability",
      "Unable to produce activity reports for a given period on request",
      "Only one person knows how to query the logs"
    ],
    "evidenceExamples": [
      "[SIEM/logging platform] dashboards and saved searches",
      "A sample generated report (e.g., failed admin logons last month)",
      "Scheduled report configuration"
    ],
    "guidance": {
      "implementation": "Use the search, dashboard, and scheduled-report features of [SIEM/logging platform] so on-demand reduction and reporting is a few clicks, and document the common queries.",
      "interview": "“Show me a report of all failed admin logons last month.”"
    },
    "sspGuidance": "State that audit reduction and report generation are provided by [SIEM/logging platform], name the typical reports and searches used, who can run them, how report needs are reviewed, and the evidence (dashboard/saved-search exports, a sample report).",
    "poamGuidance": "Likely gap: no practical way to reduce and report on logs. Remediation: configure dashboards, saved searches, and scheduled reports in [SIEM/logging platform]. Owner: IT Lead or [MSP/MSSP]. Milestone: standard report set available by a set date. Validation evidence: a generated sample report. A 1-point SPRS requirement."
  },
  "3.3.7": {
    "explanation": "All system clocks must sync to an authoritative time source so timestamps line up across systems. If the firewall and the file server disagree about what time it is, reconstructing an incident timeline becomes guesswork.",
    "commonMistakes": [
      "Network appliances drifting because nobody set NTP",
      "Mixed time zones with no documented convention",
      "No defined authoritative source"
    ],
    "evidenceExamples": [
      "NTP configuration exports (domain hierarchy, network gear, cloud)",
      "Time synchronization standard or policy",
      "Spot-check comparing timestamps across systems"
    ],
    "guidance": {
      "implementation": "Point everything at a defined authoritative time source — domain time hierarchy or trusted NTP — and verify network gear and appliances, which are most often missed.",
      "interview": "“Do your firewall and your file server agree on what time it is?”"
    },
    "sspGuidance": "Name the authoritative time source and the synchronization design (domain hierarchy, NTP for appliances), who owns time configuration, how drift is checked, and the evidence (NTP configs, spot-check record).",
    "poamGuidance": "Likely gap: appliances and servers not synced to one source. Remediation: standardize NTP configuration across all systems including network gear. Owner: IT Lead. Milestone: all systems synced by a set date. Validation evidence: config exports plus a timestamp comparison. A 1-point SPRS requirement."
  },
  "3.3.8": {
    "explanation": "Logs and logging tools must be protected so an attacker — or an insider — cannot read, alter, or delete the records that would expose them. The audit trail is only worth what its integrity is worth.",
    "commonMistakes": [
      "Admins able to purge the same logs that record their actions",
      "Log storage writable by general accounts",
      "No access restrictions on the logging platform itself"
    ],
    "evidenceExamples": [
      "[SIEM/logging platform] role-based access export",
      "Log storage permissions or immutability/retention-lock settings",
      "Audit trail of access to the logging platform"
    ],
    "guidance": {
      "implementation": "Restrict log read/manage access in [SIEM/logging platform] to a small named group, enable immutable or write-once retention where available, and log access to the logs themselves.",
      "interview": "“Who could delete logs today — and would that deletion itself be logged?”"
    },
    "sspGuidance": "Describe how audit information and tools are protected (RBAC on [SIEM/logging platform], storage permissions, immutability), who holds access and who owns it, how access is reviewed (e.g., quarterly), and the evidence (RBAC export, retention-lock settings).",
    "poamGuidance": "Likely gap: logs deletable by the people they record. Remediation: lock down platform roles, separate log administration, enable immutable retention. Owner: IT Lead or [MSP/MSSP]. Milestone: protections live by a set date. Validation evidence: RBAC export and storage settings. A 1-point SPRS requirement."
  },
  "3.3.9": {
    "explanation": "Only a small, named subset of privileged users should be able to manage logging — change what is collected, alter retention, or administer the audit platform. Managing the witness list is itself a privileged act.",
    "commonMistakes": [
      "Every admin can change audit settings",
      "No separate role for audit management",
      "Changes to logging configuration not themselves logged"
    ],
    "evidenceExamples": [
      "Audit-management role membership export from [SIEM/logging platform]",
      "Permission policy naming the authorized subset",
      "Change log of audit configuration changes"
    ],
    "guidance": {
      "implementation": "Create a dedicated audit-management role in [SIEM/logging platform] limited to named individuals, and keep general admins out of it.",
      "interview": "“Exactly who can change your logging configuration?”"
    },
    "sspGuidance": "Name the role (and the small set of people) authorized to manage audit functionality, where it is enforced ([SIEM/logging platform] RBAC), who owns membership, the review cadence, and the evidence (role membership export, policy).",
    "poamGuidance": "Likely gap: audit management open to all admins. Remediation: define the restricted role and move audit administration into it. Owner: IT Lead. Milestone: restricted role enforced by a set date. Validation evidence: membership export. A 1-point SPRS requirement."
  },
  "3.4.1": {
    "explanation": "Keep an accurate inventory of your hardware and software and a documented baseline configuration for each system type, maintained through the system's whole life. You cannot secure — or assess — what you have not listed.",
    "commonMistakes": [
      "A spreadsheet inventory that went stale years ago",
      "No documented baseline for what a properly built system looks like",
      "Shadow IT and unmanaged devices outside any inventory"
    ],
    "evidenceExamples": [
      "Asset inventory export from [endpoint management platform]",
      "Baseline configuration documents per system type",
      "Software inventory report"
    ],
    "guidance": {
      "implementation": "Use [endpoint management platform] to auto-inventory hardware and software, write a baseline document for each system type (workstation, server, network device), and update both on change.",
      "interview": "“How many laptops do you have, and what should a freshly built one look like?”"
    },
    "sspGuidance": "Describe how baselines and inventories are established and maintained: what the baselines cover, where inventories live ([endpoint management platform]), who owns them (e.g., IT Lead), the update/review cadence (on change plus periodic verification), and the evidence (inventory exports, baseline documents).",
    "poamGuidance": "Likely gap: no current inventory or documented baselines. Remediation: deploy auto-inventory, reconcile unknown assets, and author baseline docs. Owner: IT Lead or [MSP/MSSP]. Milestone: inventory reconciled and baselines approved by a set date. Validation evidence: inventory export plus baseline documents. Caution: a 5-point SPRS requirement that many other CM controls build on — close before assessment."
  },
  "3.4.2": {
    "explanation": "Apply hardened security settings — such as CIS Benchmarks or DISA STIGs — to every system, and keep them enforced over time. Settings that were set once and never checked again have usually drifted.",
    "commonMistakes": [
      "Hardening applied at build time with drift never monitored",
      "Servers and network gear skipped while workstations get attention",
      "No defined hardening standard at all"
    ],
    "evidenceExamples": [
      "[endpoint management platform] configuration profiles or group policy exports",
      "CIS benchmark or STIG compliance report",
      "Drift/compliance monitoring output"
    ],
    "guidance": {
      "implementation": "Pick a hardening standard (CIS Benchmarks are a practical small-business choice), deploy it via [endpoint management platform] or group policy, and monitor compliance so drift is caught.",
      "interview": "“What hardening standard do you follow, and how do you catch a machine that drifts from it?”"
    },
    "sspGuidance": "Name the configuration standard and where it is enforced ([endpoint management platform] profiles, group policy), the systems in scope (workstations, servers, network devices), who owns the baseline (e.g., IT Lead), how compliance and drift are monitored and how often, and the evidence (profile exports, compliance reports).",
    "poamGuidance": "Likely gap: no enforced hardening standard. Remediation: adopt CIS/STIG settings, deploy via management tooling, remediate drift. Owner: IT Lead or [MSP/MSSP]. Milestone: baseline enforced on all in-scope systems by a set date. Validation evidence: compliance report against the chosen benchmark. Caution: a 5-point SPRS requirement — treat as pre-assessment work."
  },
  "3.4.3": {
    "explanation": "Changes to systems should go through a simple documented process — request, review, approve, record — so you always know what changed, when, and why. The process can be lightweight; it cannot be informal.",
    "commonMistakes": [
      "Emergency changes that never get documented afterward",
      "No approval step before significant changes",
      "No change log to look back on when something breaks"
    ],
    "evidenceExamples": [
      "Change management procedure",
      "Change records in [ticketing system] with approvals",
      "Sample emergency-change record with retroactive review"
    ],
    "guidance": {
      "implementation": "Run all system changes through [ticketing system] with a named approver and a rollback note; keep an expedited path for emergencies that still gets documented within a day or two.",
      "interview": "“Show me the record for the last change made to your firewall.”"
    },
    "sspGuidance": "Describe the change process (request, review, approval, record), where it is tracked ([ticketing system]), who approves (e.g., IT Lead or CAB), how emergency changes are handled, the review cadence of the change log, and the evidence (procedure, sample change records).",
    "poamGuidance": "Likely gap: undocumented ad hoc changes. Remediation: adopt the lightweight change workflow in [ticketing system] and train admins to use it. Owner: IT Lead. Milestone: all changes flowing through the process by a set date. Validation evidence: a month of change records. A 1-point SPRS requirement."
  },
  "3.4.4": {
    "explanation": "Before a change goes in, someone must ask what it could break from a security standpoint — does this open a port, weaken authentication, expose CUI — and record the answer.",
    "commonMistakes": [
      "Security impact never considered before changes",
      "An impact checkbox ticked with no real analysis behind it",
      "No security-minded reviewer involved in changes"
    ],
    "evidenceExamples": [
      "Change records showing a completed security impact field",
      "Reviewer assignment for security impact",
      "A sample analysis for a significant change"
    ],
    "guidance": {
      "implementation": "Add a required security-impact section to the change template in [ticketing system] — a few prompted questions are enough — and name who answers it for significant changes.",
      "interview": "“Who looked at the security impact of your last major change, and what did they conclude?”"
    },
    "sspGuidance": "State that security impact analysis is part of the change process, where it is captured (the change record in [ticketing system]), who performs it (e.g., IT Lead or [MSP/MSSP] reviewer), when it is required (all changes or defined significant changes), and the evidence (completed analyses on recent changes).",
    "poamGuidance": "Likely gap: changes reviewed for function but not security. Remediation: add the impact-analysis step and reviewer to the workflow. Owner: IT Lead. Milestone: step live and used on every qualifying change by a set date. Validation evidence: recent change records with completed analyses. A 1-point SPRS requirement."
  },
  "3.4.5": {
    "explanation": "Only authorized people should be physically and logically able to change systems. Production changes belong to named admins; the rights, the consoles, and the server room are all part of that boundary.",
    "commonMistakes": [
      "Developers or general staff able to alter production systems",
      "Broad physical access to server and network closets",
      "No logical restriction on who can push configuration changes"
    ],
    "evidenceExamples": [
      "Change-capable role membership export from [identity provider]",
      "Physical access list/records for server areas from [facility/access control system]",
      "Configuration showing change rights limited to admin roles"
    ],
    "guidance": {
      "implementation": "Limit change rights to defined admin roles in [identity provider], lock server/network areas via [facility/access control system], and keep both access lists short and current.",
      "interview": "“Who can actually push a change to production systems — and who cannot?”"
    },
    "sspGuidance": "Define the physical and logical access restrictions for changes: who holds change rights (admin roles), how they are enforced ([identity provider] roles, locked facilities, restricted consoles), who owns the lists, the review cadence (e.g., quarterly), and the evidence (role exports, facility access records).",
    "poamGuidance": "Likely gap: change access broader than the named admin set. Remediation: tighten role membership and physical access to defined personnel. Owner: IT Lead with facilities. Milestone: restricted lists enforced by a set date. Validation evidence: role and access exports. Caution: a 5-point SPRS requirement — close before assessment."
  },
  "3.4.6": {
    "explanation": "Configure systems to do only what they are for. Extra software, services, and features that nobody uses are pure attack surface — remove or disable them.",
    "commonMistakes": [
      "Workstation images full of preinstalled bloatware",
      "Unused server roles and features left enabled",
      "Nobody ever questions vendor defaults"
    ],
    "evidenceExamples": [
      "Baseline documentation showing disabled services/features",
      "Software inventory compared against the approved list",
      "System build checklist"
    ],
    "guidance": {
      "implementation": "Strip standard images to what the role needs, disable unneeded services and features in the baselines, and review installed functionality periodically against the mission.",
      "interview": "“What did you remove or disable from the default install on your servers?”"
    },
    "sspGuidance": "State the essential-capabilities approach: how systems are configured for least functionality (hardened images, disabled services), where it is defined (baseline docs) and enforced ([endpoint management platform]), who owns it, the review cadence for installed functionality, and the evidence (baselines, inventory comparisons).",
    "poamGuidance": "Likely gap: default builds with everything enabled. Remediation: define least-functionality baselines and remediate existing systems. Owner: IT Lead or [MSP/MSSP]. Milestone: baselines applied fleet-wide by a set date. Validation evidence: before/after service inventories. Caution: a 5-point SPRS requirement — plan as pre-assessment work."
  },
  "3.4.7": {
    "explanation": "Specifically identify and shut off nonessential programs, ports, protocols, and services — the legacy file-sharing protocol, the remote shell nobody uses, the listening port from an old install.",
    "commonMistakes": [
      "Legacy protocols (e.g., SMBv1, Telnet) still enabled",
      "No periodic review of listening ports and running services",
      "Temporary services enabled for a project and left running for years"
    ],
    "evidenceExamples": [
      "Port/protocol/service review records",
      "[firewall platform] rules blocking nonessential protocols",
      "Vulnerability or port scan confirming closures"
    ],
    "guidance": {
      "implementation": "Scan for listening services, decide essential versus not, disable the rest in baselines and at [firewall platform], and re-scan periodically to catch regressions.",
      "interview": "“When did you last review which ports your servers listen on?”"
    },
    "sspGuidance": "Describe how nonessential programs, ports, protocols, and services are identified and restricted (baseline settings, firewall rules), where the authoritative allowed list lives, who owns it, the review cadence (e.g., quarterly scans), and the evidence (review records, scan results, rule exports).",
    "poamGuidance": "Likely gap: legacy services and open ports never pruned. Remediation: inventory, disable nonessential items, and block at the firewall. Owner: IT Lead or [MSP/MSSP]. Milestone: allowed list enforced and verified by scan by a set date. Validation evidence: scan comparison. Caution: a 5-point SPRS requirement — close before assessment."
  },
  "3.4.8": {
    "explanation": "Control what software is even allowed to run — at minimum block known-bad software, and ideally allow only approved software to execute (allowlisting). This is one of the strongest practical defenses against ransomware.",
    "commonMistakes": [
      "Treating antivirus alone as the software-execution policy",
      "An allowlist tool deployed but left in audit-only mode forever",
      "Policy lists never maintained as business software changes"
    ],
    "evidenceExamples": [
      "Application control policy export (e.g., from [endpoint management platform] or [EDR solution])",
      "Approved software list",
      "A sample blocked-execution event"
    ],
    "guidance": {
      "implementation": "Deploy application control through [endpoint management platform] or [EDR solution] — deny-by-exception at minimum, permit-by-exception where feasible — and assign an owner to keep the lists current.",
      "interview": "“If a user downloads a random executable from the internet, will it run?”"
    },
    "sspGuidance": "State the policy model (deny-by-exception or permit-by-exception), where it is enforced (application control in [endpoint management platform]/[EDR solution]), the scope (all endpoints/servers), who owns list maintenance, the review cadence, and the evidence (policy export, approved list, block events).",
    "poamGuidance": "Likely gap: nothing constrains what executes. Remediation: roll out application control in audit mode, tune, then enforce. Owner: IT Lead or [MSP/MSSP]. Milestone: enforcement mode live on all endpoints by a set date. Validation evidence: policy export plus a demonstrated block. Caution: a 5-point SPRS requirement — prioritize it; it also pays the biggest ransomware-defense dividend."
  },
  "3.4.9": {
    "explanation": "Set and enforce rules for what users may install themselves — ideally nothing without approval, with a company catalog or request path for sanctioned software.",
    "commonMistakes": [
      "Users hold admin rights, so anything installs",
      "No approved software list or request process",
      "Install requests handled informally with no record"
    ],
    "evidenceExamples": [
      "User installation policy",
      "Software request records in [ticketing system]",
      "Admin rights removal report"
    ],
    "guidance": {
      "implementation": "Remove local admin from standard users, publish an approved software catalog, and route new-software requests through [ticketing system] for review.",
      "interview": "“How would an employee get a new app installed — and could they bypass that process?”"
    },
    "sspGuidance": "State the user-installed software policy (what is allowed, the request/approval path), how it is enforced technically (no admin rights, application control), who approves requests, how installed software is monitored against policy, and the evidence (policy, request records, rights report).",
    "poamGuidance": "Likely gap: users install anything. Remediation: remove admin rights, stand up the catalog/request process. Owner: IT Lead. Milestone: enforcement live by a set date. Validation evidence: rights report plus request records. A 1-point SPRS requirement."
  },
  "3.5.1": {
    "explanation": "Every user, service, and device must have its own unique identity before touching company systems. Identity is the foundation every other control builds on — if you cannot say who or what is connecting, nothing downstream can be trusted.",
    "commonMistakes": [
      "Shared logins used by multiple people",
      "Service accounts nobody documented or owns",
      "Devices not uniquely identified on the network"
    ],
    "evidenceExamples": [
      "[identity provider] account export (users and service accounts)",
      "Device identity/enrollment list from [MDM solution] or certificates",
      "Service account inventory with owners"
    ],
    "guidance": {
      "implementation": "Issue unique accounts in [identity provider] for every user, document every service account with an owner and purpose, and identify devices through [MDM solution] enrollment or certificates.",
      "interview": "“Does anything sign in to your systems that you cannot trace to a single person, service, or device?”"
    },
    "sspGuidance": "State that all users, processes, and devices are uniquely identified, where identity is managed ([identity provider], device enrollment in [MDM solution]), who owns identity lifecycle (e.g., IT Lead), how identity records are reviewed (account audits), and the evidence (account exports, device list, service account inventory).",
    "poamGuidance": "Likely gap: shared accounts and undocumented service/device identities. Remediation: split shared logins into named accounts, inventory service accounts, and enroll devices for identity. Owner: IT Lead. Milestone: unique identity for every user/process/device by a set date. Validation evidence: account and device exports. Caution: a 5-point SPRS requirement and a prerequisite for the rest of the IA family — close before assessment."
  },
  "3.5.2": {
    "explanation": "Systems must verify the claimed identity of users, devices, and processes before granting access — no anonymous shares, no unauthenticated paths to CUI, no default credentials still active.",
    "commonMistakes": [
      "Network shares reachable without authentication",
      "Devices joining the network without being authenticated",
      "Factory-default passwords still active on appliances and printers"
    ],
    "evidenceExamples": [
      "Authentication policy/configuration from [identity provider]",
      "802.1X or device certificate configuration",
      "Default-credential audit of appliances and network gear"
    ],
    "guidance": {
      "implementation": "Require authentication on every path to company data, authenticate devices with certificates or 802.1X, and audit appliances for default credentials.",
      "interview": "“Is there any way to reach CUI data without signing in first?”"
    },
    "sspGuidance": "Describe how users, processes, and devices are authenticated before access ([identity provider] sign-in, device certificates/802.1X), confirm no unauthenticated access paths exist, who owns authentication configuration, how it is verified (periodic audit), and the evidence (configs, default-credential audit results).",
    "poamGuidance": "Likely gap: unauthenticated paths (open shares, default creds, unauthenticated devices). Remediation: close anonymous access, rotate default credentials, deploy device authentication. Owner: IT Lead or [MSP/MSSP]. Milestone: zero unauthenticated paths verified by a set date. Validation evidence: audit results and configuration exports. Caution: a 5-point SPRS requirement — treat as a pre-assessment fix."
  },
  "3.5.3": {
    "explanation": "Require a second factor — authenticator app, token, or security key — in addition to a password: for everyone accessing the network remotely or over it, and for every privileged account even when local. Passwords alone do not survive modern phishing.",
    "commonMistakes": [
      "MFA on email only, not on all CUI applications and network access",
      "SMS codes used for privileged accounts",
      "Legacy protocols left enabled that quietly bypass MFA",
      "Temporary MFA exclusions that never expire"
    ],
    "evidenceExamples": [
      "MFA enforcement policy export from [identity provider]",
      "Conditional access policies covering all apps and users",
      "MFA registration report",
      "Documented exception list with expiry dates"
    ],
    "guidance": {
      "implementation": "Enforce MFA through [identity provider] conditional access for all users and applications, require phishing-resistant methods (security keys) for administrators, and block legacy authentication protocols that bypass MFA.",
      "interview": "“Which accounts can sign in today with only a password — and why?”"
    },
    "sspGuidance": "State exactly which access requires MFA (local and network privileged access, all network user access), the factor types allowed per population (e.g., security keys for admins, authenticator app for users), where it is enforced ([identity provider] conditional access), who owns the policy, how exceptions are documented and expired, the review cadence, and the evidence (policy exports, registration report, exception list).",
    "poamGuidance": "Likely gap: MFA partial — covering email but not all network access or privileged use. Remediation: extend conditional access to all apps, enforce admin MFA everywhere, kill legacy auth. Owner: IT Lead. Milestone: MFA enforced for all in-scope access by a set date. Validation evidence: policy export plus a sign-in log review showing no password-only access. Caution: weighted up to 5 SPRS points and one of the most scrutinized requirements in any assessment — do not plan to carry this as an open POA&M."
  },
  "3.5.4": {
    "explanation": "Use authentication that cannot simply be recorded and replayed — modern protocols like Kerberos, TLS-protected sign-in, and FIDO2 keys, instead of legacy schemes that send reusable secrets.",
    "commonMistakes": [
      "Legacy protocols (NTLMv1, basic authentication) still enabled",
      "Custom or legacy apps sending credentials without TLS",
      "Assuming MFA alone covers replay resistance without checking the protocol"
    ],
    "evidenceExamples": [
      "Legacy authentication block policy in [identity provider]",
      "Protocol configuration audit (NTLM levels, TLS on auth paths)",
      "Authentication flow review for custom applications"
    ],
    "guidance": {
      "implementation": "Disable basic/legacy authentication in [identity provider] and OS policy, require TLS on every authentication path, and check any custom apps for replay-prone schemes.",
      "interview": "“Have you disabled the old protocols — NTLMv1, basic authentication — across the environment?”"
    },
    "sspGuidance": "State that authentication to network accounts uses replay-resistant mechanisms (modern protocols, TLS-protected flows, hardware-backed factors), where legacy schemes are blocked, who owns protocol policy, how it is verified, and the evidence (block policy export, protocol audit).",
    "poamGuidance": "Likely gap: legacy replay-prone protocols still active. Remediation: block legacy auth, fix dependent apps or isolate them. Owner: IT Lead. Milestone: legacy protocols disabled by a set date. Validation evidence: policy export plus sign-in logs free of legacy auth. A 1-point SPRS requirement."
  },
  "3.5.5": {
    "explanation": "Do not recycle usernames or IDs for a defined period. A new hire must never inherit a former employee's identifier — and the lingering permissions, mailbox rules, and audit history that come with it.",
    "commonMistakes": [
      "Re-issuing a departed employee's username to a new hire",
      "Deleting and recreating accounts in ways that break audit traceability",
      "No defined period before an identifier could be reused"
    ],
    "evidenceExamples": [
      "Identifier lifecycle policy with the reuse prohibition period",
      "Account naming and provisioning procedure",
      "Directory export showing disabled (not deleted) departed accounts"
    ],
    "guidance": {
      "implementation": "Disable and retain departed accounts rather than deleting them, and write the identifier-reuse prohibition (e.g., not within X years) into the provisioning procedure.",
      "interview": "“If two people named John Smith work here five years apart, do they end up with the same username?”"
    },
    "sspGuidance": "State the defined period during which identifiers are not reused, where the rule is applied (provisioning in [identity provider]), who owns identity lifecycle, how compliance is checked, and the evidence (policy, provisioning procedure, directory export).",
    "poamGuidance": "Likely gap: no documented reuse prevention. Remediation: write the rule into the provisioning procedure and switch to disable-and-retain. Owner: IT Lead. Milestone: procedure updated by a set date. Validation evidence: the procedure plus a directory check. A 1-point SPRS requirement and usually a one-day fix."
  },
  "3.5.6": {
    "explanation": "Accounts unused for a defined period must be disabled automatically. Dormant accounts are a favorite door for attackers — nobody notices when they start being used.",
    "commonMistakes": [
      "No inactivity sweep at all",
      "Service accounts excluded and then forgotten forever",
      "No defined inactivity threshold"
    ],
    "evidenceExamples": [
      "Inactivity report or automation from [identity provider]",
      "Log of accounts disabled for inactivity",
      "Policy defining the threshold (e.g., 90 days)"
    ],
    "guidance": {
      "implementation": "Define the inactivity threshold (commonly 60–90 days), automate detection and disablement in [identity provider], and review service-account exceptions explicitly.",
      "interview": "“What happens to an account that has not signed in for 90 days?”"
    },
    "sspGuidance": "State the inactivity threshold and the disablement process (automated or scheduled review), where it runs ([identity provider]), who owns it, the cadence, and the evidence (automation config or recurring report, disablement log).",
    "poamGuidance": "Likely gap: dormant accounts stay enabled indefinitely. Remediation: define the threshold and automate the sweep. Owner: IT Lead. Milestone: sweep operating and backlog cleared by a set date. Validation evidence: report showing no enabled accounts past threshold. A 1-point SPRS requirement."
  },
  "3.5.7": {
    "explanation": "Enforce minimum password strength everywhere passwords are created or changed — adequate length, complexity or modern length-based rules, and a ban on the obvious choices.",
    "commonMistakes": [
      "Weak minimum lengths surviving from old defaults",
      "Apps outside the domain not following the policy",
      "No banned-password list, so seasonal favorites pass"
    ],
    "evidenceExamples": [
      "Password policy export from [identity provider]",
      "Banned-password configuration",
      "Policy document defining complexity requirements"
    ],
    "guidance": {
      "implementation": "Enforce length and complexity (or modern long-passphrase rules) plus a banned-password list in [identity provider], and confirm standalone apps inherit or mirror the policy.",
      "interview": "“What is the minimum password your systems will accept right now?”"
    },
    "sspGuidance": "State the password construction rules (length, complexity, banned terms) and where they are enforced ([identity provider], OS policy, standalone apps), who owns password policy, the review cadence, and the evidence (policy exports).",
    "poamGuidance": "Likely gap: weak or inconsistent password rules. Remediation: raise the policy in [identity provider] and align outliers. Owner: IT Lead. Milestone: unified policy enforced by a set date. Validation evidence: policy exports across systems. A 1-point SPRS requirement."
  },
  "3.5.8": {
    "explanation": "Stop users from rotating among a handful of old passwords by enforcing password history for a set number of generations.",
    "commonMistakes": [
      "Password history not configured",
      "Cloud apps outside the history policy",
      "Users cycling trivial variations that history rules do not catch"
    ],
    "evidenceExamples": [
      "Password history setting export (e.g., 24 generations)",
      "Policy document",
      "Banned-password configuration catching near-duplicates"
    ],
    "guidance": {
      "implementation": "Set password history (commonly 24 generations) in [identity provider] and group policy, paired with the banned-password list to catch near-duplicates.",
      "interview": "“Could I change my password and immediately change it back?”"
    },
    "sspGuidance": "State the number of generations remembered and where it is enforced, who owns the setting, how it is verified, and the evidence (policy export).",
    "poamGuidance": "Likely gap: reuse not prevented. Remediation: configure history across identity systems. Owner: IT Lead. Milestone: enforced by a set date. Validation evidence: policy export. A 1-point SPRS requirement and a same-day fix in most environments."
  },
  "3.5.9": {
    "explanation": "When IT issues a temporary password, the system must force a change to a permanent one at first use — temporary credentials must never quietly become permanent ones.",
    "commonMistakes": [
      "Temporary passwords that never expire or force a change",
      "The same well-known temporary password used for everyone",
      "Reset passwords sent over insecure channels"
    ],
    "evidenceExamples": [
      "Provisioning procedure showing change-at-first-logon",
      "Account settings export with the force-change flag",
      "Password reset workflow documentation"
    ],
    "guidance": {
      "implementation": "Configure provisioning and resets to require change at first logon, generate unique temporary passwords, and deliver them through a secure channel.",
      "interview": "“After a password reset, can the user just keep using the temporary password?”"
    },
    "sspGuidance": "Describe the temporary password flow (unique value, secure delivery, forced change at first logon), where it is enforced ([identity provider] provisioning), who owns the procedure, and the evidence (procedure, account settings, a sample reset record).",
    "poamGuidance": "Likely gap: temporary passwords usable indefinitely. Remediation: enforce change-at-first-logon and fix the reset procedure. Owner: IT Lead. Milestone: enforced by a set date. Validation evidence: procedure plus a tested reset. A 1-point SPRS requirement."
  },
  "3.5.10": {
    "explanation": "Passwords must be cryptographically protected everywhere they are stored and whenever they travel — no plaintext passwords in spreadsheets, scripts, databases, or on the wire.",
    "commonMistakes": [
      "Passwords kept in shared spreadsheets or text files",
      "Legacy applications storing reversible passwords",
      "Credentials sent over unencrypted protocols (HTTP, LDAP without TLS)"
    ],
    "evidenceExamples": [
      "Password hashing configuration or vendor documentation",
      "TLS enforcement on authentication paths",
      "[password vault] deployment evidence and a sweep for plaintext credential files"
    ],
    "guidance": {
      "implementation": "Require TLS on every authentication path, confirm systems store passwords with modern hashing, move shared credentials into [password vault], and sweep file shares for plaintext credential stores.",
      "interview": "“Where, anywhere in the company, is a password written down in plaintext — files, scripts, wikis?”"
    },
    "sspGuidance": "State that passwords are cryptographically protected in storage and transmission, name the mechanisms (TLS on auth paths, hashed storage, [password vault] for shared secrets), who owns credential hygiene, how plaintext storage is prevented and checked, and the evidence (configs, vault deployment, sweep results).",
    "poamGuidance": "Likely gap: plaintext credentials in files and legacy apps. Remediation: deploy [password vault], remediate plaintext stores, force TLS on auth traffic. Owner: IT Lead. Milestone: plaintext eliminated and vault adopted by a set date. Validation evidence: sweep results plus configuration exports. Caution: a 5-point SPRS requirement — close before assessment."
  },
  "3.5.11": {
    "explanation": "Systems should mask passwords as they are typed — dots or asterisks — so someone watching the screen learns nothing.",
    "commonMistakes": [
      "Custom or legacy applications echoing passwords on screen",
      "Kiosk or shared screens visible to the public during sign-in",
      "Reveal-password options enabled where shoulder surfing is a real risk"
    ],
    "evidenceExamples": [
      "Screenshots of masked authentication prompts",
      "Application configuration showing obscured feedback",
      "Spot-check record across in-scope applications"
    ],
    "guidance": {
      "implementation": "Verify masking on every sign-in surface, including custom and legacy apps; standard platforms handle this by default, so the work is checking the exceptions.",
      "interview": "“Do any of your applications show the password on screen as it is typed?”"
    },
    "sspGuidance": "State that authentication feedback is obscured on all systems, note any verified exceptions and their mitigation, who owns verification, and the evidence (screenshots, spot-check record).",
    "poamGuidance": "Likely gap: a legacy app echoing credentials. Remediation: reconfigure or replace the offending interface. Owner: IT Lead. Milestone: all surfaces masked by a set date. Validation evidence: screenshots. A 1-point SPRS requirement, rarely a heavy lift."
  },
  "3.6.1": {
    "explanation": "Have a real, written, resourced plan for handling incidents end to end — preparation, detection, analysis, containment, recovery — with named people and rehearsed steps, not just good intentions.",
    "commonMistakes": [
      "A plan exists on paper but nobody has been trained on it",
      "No named roles, contacts, or escalation path",
      "No preparation: tooling, contact lists, and external support not lined up in advance"
    ],
    "evidenceExamples": [
      "Incident response plan",
      "IR team roster with roles and contact details",
      "Runbooks/playbooks for likely scenarios (ransomware, BEC, lost device)"
    ],
    "guidance": {
      "implementation": "Write the IR plan, name the team and their backups, define escalation including [MSP/MSSP] and legal contacts, and pre-stage the tooling and decisions (isolation steps, who can authorize a shutdown).",
      "interview": "“It is 2 a.m. and ransomware is spreading — who gets called first, and what do they do?”"
    },
    "sspGuidance": "Describe the operational incident-handling capability: the plan and its phases (preparation through recovery), the named team and roles, where detection feeds from ([SIEM/logging platform], [EDR solution]), who owns the plan (e.g., Security lead or CIO), the review/update cadence (annually and after incidents), and the evidence (plan, roster, runbooks).",
    "poamGuidance": "Likely gap: no operational IR capability beyond ad hoc response. Remediation: author the plan, name and train the team, pre-arrange [MSP/MSSP] support. Owner: CIO or Security lead. Milestone: plan approved and team briefed by a set date. Validation evidence: the plan plus training/briefing records. Caution: a 5-point SPRS requirement — close before assessment."
  },
  "3.6.2": {
    "explanation": "Every incident must be tracked from open to close, documented, and reported to the right officials — including the 72-hour DFARS 252.204-7012 report to DoD via DIBNet when covered defense information is involved.",
    "commonMistakes": [
      "Incidents handled informally with no record kept",
      "Nobody aware of the 72-hour DoD reporting duty or holding a DIBNet-capable certificate",
      "No internal chain defining who reports what to whom"
    ],
    "evidenceExamples": [
      "Incident log/register in [ticketing system]",
      "Reporting procedure citing the DFARS 252.204-7012 72-hour requirement",
      "A sample closed incident record with timeline and disposition"
    ],
    "guidance": {
      "implementation": "Keep an incident register, define internal and external reporting (who reports, to whom, on what clock), and verify ahead of time that you can actually file a DIBNet report — including the medium-assurance certificate it requires.",
      "interview": "“Who in this company is set up to file a DIBNet report, and what is the deadline?”"
    },
    "sspGuidance": "Describe how incidents are tracked and documented (register in [ticketing system]), the internal reporting chain, the external reporting obligations (DFARS 7012/DIBNet within 72 hours where applicable) and who executes them, the review cadence of the procedure, and the evidence (register, procedure, sample records).",
    "poamGuidance": "Likely gap: no tracking and no reporting readiness. Remediation: stand up the register, write the reporting procedure, obtain DIBNet access prerequisites. Owner: CIO or Security lead. Milestone: register and reporting path verified by a set date. Validation evidence: register plus a reporting-path walkthrough. Caution: a 5-point SPRS requirement with contractual teeth — close before assessment."
  },
  "3.6.3": {
    "explanation": "Exercise the plan — a tabletop or simulation — so the first time your team runs it is not during a real incident. Testing is what turns a document into a capability.",
    "commonMistakes": [
      "The plan has never been exercised",
      "Tests exclude leadership, who then improvise during real events",
      "Lessons learned never folded back into the plan"
    ],
    "evidenceExamples": [
      "Tabletop exercise record with date, scenario, and participants",
      "After-action report",
      "Plan change log showing updates from exercise findings"
    ],
    "guidance": {
      "implementation": "Run at least an annual tabletop with a realistic scenario (ransomware or business email compromise), include leadership, document gaps, and update the plan.",
      "interview": "“When did you last practice an incident, and what changed afterward?”"
    },
    "sspGuidance": "State how and how often IR is tested (e.g., annual tabletop), who participates, who owns the exercise, how findings drive plan updates, and the evidence (exercise records, after-action reports, plan revision history).",
    "poamGuidance": "Likely gap: untested plan. Remediation: schedule and run a tabletop, document findings. Owner: Security lead. Milestone: first exercise complete by a set date. Validation evidence: exercise record and after-action report. A 1-point SPRS requirement."
  },
  "3.7.1": {
    "explanation": "Keep systems maintained — patches, firmware, hardware upkeep — on a schedule. Unmaintained systems decay into vulnerable ones; maintenance is a security function, not just an IT chore.",
    "commonMistakes": [
      "No maintenance schedule; things are fixed only when they break",
      "Network gear firmware years out of date",
      "Maintenance performed but never recorded"
    ],
    "evidenceExamples": [
      "Maintenance schedule and completed records",
      "Patch/update reports from [endpoint management platform]",
      "Firmware update log for network devices"
    ],
    "guidance": {
      "implementation": "Define maintenance windows and cycles (OS patching, firmware review, hardware checks), execute them on schedule, and record completion in [ticketing system].",
      "interview": "“When was your firewall's firmware last updated — and was that on a schedule or by accident?”"
    },
    "sspGuidance": "Describe the maintenance program: what is maintained and on what cycle, who performs it (internal or [MSP/MSSP]), where records are kept ([ticketing system]), the review cadence of the schedule, and the evidence (schedule, completion records, update reports).",
    "poamGuidance": "Likely gap: reactive, unrecorded maintenance. Remediation: define the schedule and start recording completions. Owner: IT Lead or [MSP/MSSP]. Milestone: first full maintenance cycle completed on schedule by a set date. Validation evidence: schedule plus completion records. Caution: a 3-point SPRS requirement — close before assessment where practical."
  },
  "3.7.2": {
    "explanation": "Control the tools, techniques, and people used for maintenance. Vendor laptops, diagnostic USB drives, and remote support sessions are all ways into your environment and need the same scrutiny as any other access.",
    "commonMistakes": [
      "A vendor plugging a personal laptop into the production network",
      "Maintenance tools and media used without any vetting",
      "Remote support sessions running unsupervised and unlogged"
    ],
    "evidenceExamples": [
      "Approved maintenance tools list",
      "Vendor access procedure and signed acknowledgments",
      "Maintenance session records (who, what, when, supervised by whom)"
    ],
    "guidance": {
      "implementation": "Approve the maintenance toolset, require company-controlled media for diagnostics, supervise and log vendor work, and route remote maintenance through your approved access path.",
      "interview": "“When the copier tech or server vendor shows up, what are they allowed to plug in?”"
    },
    "sspGuidance": "Describe the controls over maintenance tools, techniques, and personnel: the approved tools list, media handling rules, vendor supervision requirements, where sessions are logged, who owns vendor maintenance (e.g., IT Lead), the review cadence, and the evidence (tools list, procedures, session records).",
    "poamGuidance": "Likely gap: uncontrolled vendor tools and sessions. Remediation: define the approved-tools rule, vendor procedure, and session logging. Owner: IT Lead. Milestone: controls in force for all maintenance by a set date. Validation evidence: procedure plus recent session records. Caution: a 5-point SPRS requirement — close before assessment."
  },
  "3.7.3": {
    "explanation": "Before equipment leaves for off-site repair or disposal-adjacent maintenance, remove or sanitize any CUI on it. A failed drive sitting in a vendor's workshop is still your data.",
    "commonMistakes": [
      "Devices shipped for warranty repair with disks still inside",
      "No sanitization step in the repair workflow",
      "No record of what was sanitized and how"
    ],
    "evidenceExamples": [
      "Sanitization procedure and completed records",
      "RMA checklist including the media-removal step",
      "Certificates of sanitization or destruction"
    ],
    "guidance": {
      "implementation": "Add a mandatory step to the repair/RMA workflow: pull or cryptographically sanitize storage before equipment leaves, and record each instance.",
      "interview": "“The file server's drive fails and is under warranty — what happens to the disk?”"
    },
    "sspGuidance": "State that equipment is sanitized of CUI before off-site maintenance, the method used (media removal or sanitization technique), where the step lives (RMA/repair procedure), who performs and records it, and the evidence (procedure, sanitization records).",
    "poamGuidance": "Likely gap: equipment leaves with data aboard. Remediation: add the sanitization gate to the repair workflow. Owner: IT Lead. Milestone: gate in force by a set date. Validation evidence: updated procedure plus a completed record. A 1-point SPRS requirement."
  },
  "3.7.4": {
    "explanation": "Scan any diagnostic or test media — vendor USB drives, downloaded firmware and tools — for malicious code before it touches your systems. Maintenance media is a classic malware delivery path.",
    "commonMistakes": [
      "Vendor USB drives plugged straight into production systems",
      "Downloaded tools and firmware never verified",
      "No designated scanning step or station"
    ],
    "evidenceExamples": [
      "Media scanning procedure",
      "Scan logs from the inspection step",
      "Checksum/signature verification records for downloaded tools"
    ],
    "guidance": {
      "implementation": "Establish a scan-before-use rule: inspect maintenance media with [EDR solution] on a designated machine, and verify checksums or signatures on anything downloaded.",
      "interview": "“A vendor hands you a USB stick with a firmware update — what happens before it is used?”"
    },
    "sspGuidance": "Describe the inspection of diagnostic/test media before use (scan station with [EDR solution], checksum verification), who enforces it, where it is recorded, the review cadence of the procedure, and the evidence (procedure, scan logs).",
    "poamGuidance": "Likely gap: maintenance media used unchecked. Remediation: stand up the scan-before-use procedure and train staff and vendors. Owner: IT Lead. Milestone: procedure in force by a set date. Validation evidence: procedure plus scan logs. Caution: a 3-point SPRS requirement — close before assessment where practical."
  },
  "3.7.5": {
    "explanation": "Remote (nonlocal) maintenance sessions must use multifactor authentication and be terminated when the work ends. Standing, always-on vendor access is one of the most exploited paths into small contractors.",
    "commonMistakes": [
      "Vendor VPN or remote accounts without MFA",
      "Always-on vendor access instead of enabled-on-demand",
      "Sessions and accounts left active after the work is done"
    ],
    "evidenceExamples": [
      "MFA configuration on remote maintenance paths",
      "Vendor account policy (disabled by default, enabled per ticket)",
      "Session logs showing termination after maintenance"
    ],
    "guidance": {
      "implementation": "Require MFA on every remote maintenance path, keep vendor accounts disabled until a ticketed need, and disable them again when the session closes.",
      "interview": "“Does your IT vendor's remote access require MFA — and is it on all the time, or only when needed?”"
    },
    "sspGuidance": "State that nonlocal maintenance requires MFA and session termination, where it is enforced (remote access stack, vendor account lifecycle), who owns vendor access (e.g., IT Lead), how sessions are tracked and closed, and the evidence (MFA config, account policy, session logs).",
    "poamGuidance": "Likely gap: standing vendor access without MFA. Remediation: enforce MFA, convert vendor accounts to on-demand, verify termination. Owner: IT Lead. Milestone: all remote maintenance paths MFA-protected and on-demand by a set date. Validation evidence: configs plus session logs. Caution: a 5-point SPRS requirement and a frequent real-world breach vector — treat as a pre-assessment fix."
  },
  "3.7.6": {
    "explanation": "Maintenance workers who lack the required access authorization must be escorted and supervised while they work — including cleaning crews, HVAC techs, and one-off repair visits near CUI systems.",
    "commonMistakes": [
      "Technicians left alone in the server room",
      "No escort policy for maintenance visitors",
      "Badges granting unescorted access handed out too freely"
    ],
    "evidenceExamples": [
      "Escort/supervision policy for maintenance personnel",
      "Visitor and escort logs from [facility/access control system]",
      "Supervision records for recent maintenance visits"
    ],
    "guidance": {
      "implementation": "Require a named escort for any maintenance person without authorization, log the visit, and keep server/network areas locked so unescorted access is impossible rather than impolite.",
      "interview": "“Is the HVAC tech ever alone in the room with your servers?”"
    },
    "sspGuidance": "State the supervision rule for maintenance personnel without access authorization, how it is enforced (escort requirement, locked areas, visitor logging), who owns it (e.g., office/facility manager with IT), and the evidence (policy, escort logs).",
    "poamGuidance": "Likely gap: unescorted maintenance access. Remediation: adopt the escort rule and visitor logging. Owner: facility manager with IT Lead. Milestone: rule in force by a set date. Validation evidence: policy plus recent logs. A 1-point SPRS requirement."
  },
  "3.8.1": {
    "explanation": "Physically control and securely store anything holding CUI — paper files, USB drives, backup media, external disks. If it carries CUI, it lives locked up when not in use, and you know where it is.",
    "commonMistakes": [
      "CUI paperwork sitting in open bins and on desks",
      "External drives with CUI kept loose in drawers",
      "No inventory of media that contains CUI"
    ],
    "evidenceExamples": [
      "CUI media inventory",
      "Photos/records of locked storage (cabinets, safe)",
      "Media handling policy"
    ],
    "guidance": {
      "implementation": "Inventory all CUI media (digital and paper), store it in locked cabinets or a safe with controlled keys, and apply a clean-desk rule for CUI paper.",
      "interview": "“Where, physically, is every copy of CUI you hold — papers, drives, tapes?”"
    },
    "sspGuidance": "Describe how CUI media (paper and digital) is physically controlled and stored (locked storage locations, clean-desk rule), who owns media control, how the inventory is kept current, the review cadence, and the evidence (inventory, storage records, policy).",
    "poamGuidance": "Likely gap: CUI media unsecured and uninventoried. Remediation: inventory media, procure locked storage, set the handling rule. Owner: office manager with IT Lead. Milestone: all media inventoried and secured by a set date. Validation evidence: inventory plus storage walkthrough record. Caution: a 3-point SPRS requirement — close before assessment where practical."
  },
  "3.8.2": {
    "explanation": "Only authorized people may access CUI on media. The key list for the locked cabinet is an access control list — treat it like one, with names, approvals, and updates when people change roles.",
    "commonMistakes": [
      "Storage keys or safe codes shared widely",
      "No record of who is authorized to access stored media",
      "Departed staff still effectively holding access"
    ],
    "evidenceExamples": [
      "Authorized media access list",
      "Key/safe access records",
      "Media access policy"
    ],
    "guidance": {
      "implementation": "Name the people authorized to access CUI media, control the keys/codes accordingly, and update the list on every personnel change.",
      "interview": "“Who has the key to the cabinet with CUI media — and is that list written down?”"
    },
    "sspGuidance": "State who may access CUI on media and how that is enforced (named access list, controlled keys/codes), who owns the list, the review cadence (on personnel change plus periodic), and the evidence (access list, key records).",
    "poamGuidance": "Likely gap: media access uncontrolled in practice. Remediation: establish the named list and rekey/recode storage. Owner: office manager. Milestone: list enforced by a set date. Validation evidence: the list plus key inventory. Caution: a 3-point SPRS requirement."
  },
  "3.8.3": {
    "explanation": "Wipe or destroy media before it leaves your control — disposal, donation, resale, or reuse — using real sanitization methods, not just deleting files or formatting. This includes the disks inside printers and copiers.",
    "commonMistakes": [
      "Drives discarded or recycled intact",
      "Treating format or file deletion as sanitization",
      "Copiers and printers returned at lease end with their disks untouched"
    ],
    "evidenceExamples": [
      "Sanitization/destruction records per item",
      "Destruction certificates from [destruction vendor]",
      "Sanitization procedure referencing accepted methods"
    ],
    "guidance": {
      "implementation": "Adopt a sanitize-or-destroy procedure (cryptographic erase, verified wipe, or physical destruction with certificates), include printer/copier storage, and log every disposal.",
      "interview": "“What happened to the hard drives in the last computers you got rid of?”"
    },
    "sspGuidance": "Describe the sanitization/destruction process and methods, when it applies (disposal, reuse, lease return, repair), who performs it (internal or [destruction vendor]), where each action is recorded, and the evidence (records, certificates, procedure).",
    "poamGuidance": "Likely gap: media leaving without sanitization. Remediation: adopt the procedure, contract [destruction vendor] if needed, start logging. Owner: IT Lead. Milestone: procedure in force with first records by a set date. Validation evidence: procedure plus destruction certificates. Caution: a 5-point SPRS requirement — close before assessment."
  },
  "3.8.4": {
    "explanation": "Label media containing CUI with the required CUI markings and distribution limits so anyone handling it knows what they are holding and how to treat it.",
    "commonMistakes": [
      "Unmarked USB drives and disks holding CUI",
      "Markings improvised instead of following the CUI Registry conventions",
      "Paper files with CUI carrying no cover sheets or labels"
    ],
    "evidenceExamples": [
      "Marking procedure aligned to the CUI Registry",
      "Photos of marked media and labeled files",
      "CUI cover sheets in use"
    ],
    "guidance": {
      "implementation": "Adopt standard CUI labels and cover sheets per the NARA CUI Registry conventions, stock them where media is handled, and make marking part of the media-creation step.",
      "interview": "“If I picked a USB drive off a desk here, how would I know whether it held CUI?”"
    },
    "sspGuidance": "State that CUI media is marked with the required designations and distribution limitations, the convention followed (CUI Registry), who owns marking compliance, how it is checked (periodic spot checks), and the evidence (procedure, photos, spot-check records).",
    "poamGuidance": "Likely gap: media unmarked. Remediation: adopt the marking standard and label existing media. Owner: office manager with IT Lead. Milestone: existing media marked and procedure live by a set date. Validation evidence: spot-check record. A 1-point SPRS requirement."
  },
  "3.8.5": {
    "explanation": "When CUI media leaves the building, control who has it and keep accountability the whole way — custody logs, approved carriers, locked containers.",
    "commonMistakes": [
      "Media mailed or hand-carried with no record at all",
      "Transport in personal vehicles and unlocked bags",
      "No chain-of-custody log to reconstruct who had what"
    ],
    "evidenceExamples": [
      "Chain-of-custody/transport log",
      "Transport procedure with approved methods",
      "Locked transport container in use"
    ],
    "guidance": {
      "implementation": "Require a custody log entry for any media leaving the facility, use approved carriers or named employees, and transport in locked containers.",
      "interview": "“The last time CUI media left this office — who carried it, and where is that recorded?”"
    },
    "sspGuidance": "Describe transport controls: who may transport CUI media, the custody log, approved methods/containers, who owns the procedure, and the evidence (log entries, procedure).",
    "poamGuidance": "Likely gap: no accountability during transport. Remediation: adopt the custody log and transport rules. Owner: office manager. Milestone: procedure in force by a set date. Validation evidence: completed log entries. A 1-point SPRS requirement."
  },
  "3.8.6": {
    "explanation": "Encrypt CUI on media in transport unless you are physically safeguarding it the entire way. Encryption turns a lost package into a non-event instead of an incident.",
    "commonMistakes": [
      "Unencrypted drives shipped or carried off-site",
      "Relying on the courier's reliability as the control",
      "Encryption used but not from a FIPS-validated module"
    ],
    "evidenceExamples": [
      "Encrypted-media standard (hardware-encrypted drives or encrypted containers)",
      "Sample encrypted device configuration",
      "Transport procedure requiring encryption"
    ],
    "guidance": {
      "implementation": "Use hardware-encrypted drives or encrypted containers (FIPS-validated modules) for any CUI media that travels, and write the requirement into the transport procedure.",
      "interview": "“If the courier loses the package with your backup drive, what can whoever finds it actually read?”"
    },
    "sspGuidance": "State that CUI on transported media is encrypted (mechanism and FIPS-validated module) unless under continuous physical protection, who owns the standard, how compliance is verified, and the evidence (device configs, procedure). Cross-reference 3.13.11 for the FIPS basis.",
    "poamGuidance": "Likely gap: transported media unencrypted. Remediation: procure encrypted media and mandate its use. Owner: IT Lead. Milestone: encrypted-media standard in force by a set date. Validation evidence: device configuration plus procedure. A 1-point SPRS requirement."
  },
  "3.8.7": {
    "explanation": "Decide whether and how removable media — USB drives, SD cards, external disks — may be used at all, and enforce that decision technically. Uncontrolled USB use is both an exfiltration channel and an infection path.",
    "commonMistakes": [
      "Any USB device works on any machine",
      "No encryption requirement for permitted media",
      "Personal and company media mixed freely"
    ],
    "evidenceExamples": [
      "Removable media policy",
      "USB/device control configuration from [endpoint management platform] or [EDR solution]",
      "Approved device list and block-event samples"
    ],
    "guidance": {
      "implementation": "Deploy device control via [endpoint management platform] or [EDR solution] so only approved, encrypted media works, and keep the approved list short and owned.",
      "interview": "“What happens if I plug my personal USB stick into a workstation here?”"
    },
    "sspGuidance": "State the removable media policy (prohibited, or restricted to approved encrypted devices), where it is enforced (device control tooling), who owns approvals, how usage is monitored, and the evidence (policy, device control config, approved list).",
    "poamGuidance": "Likely gap: removable media unrestricted. Remediation: deploy device control in audit then enforce mode, define the approved list. Owner: IT Lead or [MSP/MSSP]. Milestone: enforcement live by a set date. Validation evidence: config plus a demonstrated block. Caution: a 5-point SPRS requirement — close before assessment."
  },
  "3.8.8": {
    "explanation": "Ban the use of any portable storage device that has no identifiable owner. The found-in-the-parking-lot USB stick is a classic attack delivery method, and ownerless media defeats accountability.",
    "commonMistakes": [
      "Found drives plugged in to see whose they are",
      "Company media carrying no asset tags or owner records",
      "Policy silent on ownerless devices"
    ],
    "evidenceExamples": [
      "Policy clause prohibiting ownerless portable storage",
      "Training content covering found media",
      "Device control logs showing unknown devices blocked"
    ],
    "guidance": {
      "implementation": "Write the prohibition into policy, cover it in awareness training, tag company media to owners, and let device control block unknown devices technically.",
      "interview": "“Someone finds a USB drive in the parking lot — what does your policy say they should do with it?”"
    },
    "sspGuidance": "State the prohibition on ownerless portable storage and how it is enforced (policy, training, asset-tagged media, device control), who owns it, and the evidence (policy clause, training content, block logs).",
    "poamGuidance": "Likely gap: no rule or technical control for ownerless media. Remediation: add the policy clause, train, and block unknown devices. Owner: IT Lead. Milestone: in force by a set date. Validation evidence: policy plus device control config. Caution: a 3-point SPRS requirement."
  },
  "3.8.9": {
    "explanation": "Backups containing CUI must be protected too — encrypted, access-controlled, and stored securely. A backup is a complete copy of your most sensitive data, and attackers know it.",
    "commonMistakes": [
      "Unencrypted backup drives or repositories",
      "Cloud backup buckets misconfigured or broadly accessible",
      "Backup restore rights held by far too many accounts"
    ],
    "evidenceExamples": [
      "[backup platform] encryption configuration",
      "Backup repository access control list",
      "Offsite/secondary storage security description"
    ],
    "guidance": {
      "implementation": "Enable encryption in [backup platform], restrict backup and restore rights to named admins, and verify the security of offsite or cloud copies.",
      "interview": "“Is your backup encrypted — and who can restore from it?”"
    },
    "sspGuidance": "State that backup CUI is protected at storage locations (encryption in [backup platform], restricted access, physical/cloud storage security), who owns backups, how protection is verified (config review, restore tests), and the evidence (encryption config, access list).",
    "poamGuidance": "Likely gap: unencrypted or over-accessible backups. Remediation: enable encryption, tighten access, verify offsite copies. Owner: IT Lead or [MSP/MSSP]. Milestone: protections verified by a set date. Validation evidence: configuration export plus access list. A 1-point SPRS requirement guarding a high-value target."
  },
  "3.9.1": {
    "explanation": "Screen people — background checks appropriate to the role — before they get access to systems that handle CUI. Trust is a control, and it should be established before access, not after.",
    "commonMistakes": [
      "Contractors and temps skipped entirely",
      "Screening done for some roles and not defined for others",
      "No record that screening happened before access was granted"
    ],
    "evidenceExamples": [
      "Screening policy defining checks per role",
      "HR confirmation records that screening completed (existence, not contents)",
      "Provisioning workflow showing screening precedes access"
    ],
    "guidance": {
      "implementation": "Define the screening standard per role, run it through HR before provisioning, and make the access workflow require the completed-screening confirmation — no check, no account.",
      "interview": "“Has anyone ever been given CUI access before their background screening finished?”"
    },
    "sspGuidance": "State that individuals are screened prior to CUI access, the screening standard per role, who performs it (HR, [screening provider]), how it gates provisioning, and the evidence (policy, completion confirmations, provisioning records). Keep screening contents private — the record of completion is the evidence.",
    "poamGuidance": "Likely gap: screening absent or not gating access. Remediation: define the standard and wire it into onboarding. Owner: HR with IT. Milestone: gate in force for all new access by a set date; backfill review for current holders. Validation evidence: workflow records. Caution: a 3-point SPRS requirement."
  },
  "3.9.2": {
    "explanation": "When someone leaves or changes roles, protect CUI by cutting their access fast and recovering everything — accounts, badges, devices, media — the same day, not when someone gets around to it.",
    "commonMistakes": [
      "No offboarding checklist tying HR actions to IT actions",
      "Accounts still live weeks after departure",
      "Equipment and badges never recovered",
      "Role transfers keeping all their old access"
    ],
    "evidenceExamples": [
      "Offboarding checklist plus completed examples",
      "Access-removal logs showing disablement timestamps",
      "Equipment/badge return records"
    ],
    "guidance": {
      "implementation": "Build an HR-to-IT offboarding workflow in [ticketing system]: disable accounts within a defined window, retrieve devices/badges/media, transfer file ownership, and review access on role transfers too.",
      "interview": "“For the last person who left, how many hours passed between their exit and their account being disabled?”"
    },
    "sspGuidance": "Describe how CUI and systems are protected during terminations and transfers: the workflow and its time targets (e.g., same-day disablement), who triggers it (HR) and who executes (IT), what is recovered, how transfers are handled (access re-review), and the evidence (checklist, completed records, disablement logs).",
    "poamGuidance": "Likely gap: slow, informal offboarding. Remediation: implement the joint HR/IT workflow with same-day disablement. Owner: HR and IT Lead jointly. Milestone: workflow live and tested on next departure by a set date. Validation evidence: completed offboarding records with timestamps. Caution: a 5-point SPRS requirement — close before assessment."
  },
  "3.10.1": {
    "explanation": "Only authorized people should be able to physically reach the systems and areas where CUI lives — locked doors, controlled keys or badges, and a short, current list of who is allowed in.",
    "commonMistakes": [
      "Server room or network closet left unlocked",
      "No written list of who is authorized for which area",
      "CUI work areas open to general foot traffic"
    ],
    "evidenceExamples": [
      "Authorized physical access list per area",
      "[facility/access control system] configuration or key assignment records",
      "Photos/records of secured areas"
    ],
    "guidance": {
      "implementation": "Define the controlled areas (server room, network closets, CUI work areas), lock them under [facility/access control system] or controlled keys, and keep the authorized list short and reviewed.",
      "interview": "“Who can physically touch the server that stores CUI — and is that the same set of people who should?”"
    },
    "sspGuidance": "Identify the controlled areas and the systems in them, how access is limited (badges/keys via [facility/access control system]), who owns the authorized list, the review cadence (e.g., quarterly and on personnel change), and the evidence (lists, access system records, area walkthrough).",
    "poamGuidance": "Likely gap: physical access uncontrolled or undocumented. Remediation: lock down areas, establish the authorized list, control keys/badges. Owner: facility manager with IT Lead. Milestone: areas controlled and lists current by a set date. Validation evidence: access list plus access-control records. Caution: a 5-point SPRS requirement — close before assessment."
  },
  "3.10.2": {
    "explanation": "Protect and monitor the facility itself and its support infrastructure — alarms, cameras, locks, and the power/HVAC that the equipment hosting CUI depends on.",
    "commonMistakes": [
      "No after-hours monitoring at all",
      "Cameras installed but dead or never reviewed",
      "Support systems (power, cooling) ignored as a security concern"
    ],
    "evidenceExamples": [
      "Alarm and camera system records or monitoring agreement",
      "Facility security description",
      "Maintenance records for support infrastructure"
    ],
    "guidance": {
      "implementation": "Cover entry points and server areas with alarms and cameras, arrange monitoring or alerting (e.g., [monitoring service]), and treat power/HVAC for the server area as protected infrastructure.",
      "interview": "“If someone forced a door at 3 a.m. on a Saturday, what would happen?”"
    },
    "sspGuidance": "Describe facility protection and monitoring: physical safeguards (alarms, cameras, locks), monitoring arrangements and who responds, support infrastructure protections, who owns facility security, the review cadence, and the evidence (system records, agreements).",
    "poamGuidance": "Likely gap: no monitoring or unprotected support systems. Remediation: deploy/contract alarm and camera coverage with response. Owner: facility manager. Milestone: monitoring live by a set date. Validation evidence: monitoring agreement plus an alarm test record. Caution: a 5-point SPRS requirement — close before assessment."
  },
  "3.10.3": {
    "explanation": "Visitors get escorted and watched in areas where CUI is handled. Friendly does not mean authorized — the escort is what keeps a visit from becoming uncontrolled access.",
    "commonMistakes": [
      "Visitors roaming unescorted after sign-in",
      "Visitor badges issued without an assigned escort",
      "Deliveries walked straight into work areas"
    ],
    "evidenceExamples": [
      "Visitor policy with escort requirement",
      "Visitor log including escort names",
      "Visitor badge process description"
    ],
    "guidance": {
      "implementation": "Require sign-in, a visitor badge, and a named escort for all visitors in CUI areas; route deliveries to a controlled reception point.",
      "interview": "“Could a visitor walk from your lobby to an engineer's desk unaccompanied?”"
    },
    "sspGuidance": "State the escort and monitoring rule for visitors, where it applies (areas with CUI activity), who owns the visitor process, how it is recorded (visitor log with escorts), and the evidence (policy, logs).",
    "poamGuidance": "Likely gap: unescorted visitors. Remediation: implement sign-in, badging, and escorts. Owner: office manager. Milestone: process live by a set date. Validation evidence: visitor log entries. A 1-point SPRS requirement."
  },
  "3.10.4": {
    "explanation": "Keep records of who entered controlled areas and when — badge system logs or sign-in sheets that you actually retain and could produce on request.",
    "commonMistakes": [
      "No record for after-hours entry",
      "Sign-in sheets discarded after a week",
      "Badge logs never retained or reviewed"
    ],
    "evidenceExamples": [
      "Badge access logs from [facility/access control system]",
      "Visitor sign-in sheets with retention practice",
      "Log retention policy"
    ],
    "guidance": {
      "implementation": "Retain badge logs and sign-in records for a defined period (commonly one year), and spot-review them periodically.",
      "interview": "“Show me who entered the server room last Tuesday.”"
    },
    "sspGuidance": "Describe the physical access audit logs kept (badge logs, sign-in sheets), the retention period, who owns them, the review cadence, and the evidence (sample logs, retention setting).",
    "poamGuidance": "Likely gap: entry records not kept or retained. Remediation: enable badge logging/retention and formalize sign-in retention. Owner: facility manager. Milestone: retention in force by a set date. Validation evidence: retrievable logs from a past date. A 1-point SPRS requirement."
  },
  "3.10.5": {
    "explanation": "Track and control keys, badges, and door codes — know who holds what, recover them at departure, and rekey or recode when control is lost.",
    "commonMistakes": [
      "No inventory of issued keys",
      "Departed employees keeping badges or keys",
      "Door codes unchanged for years and widely known"
    ],
    "evidenceExamples": [
      "Key/badge inventory with holders",
      "Issuance and return records",
      "Rekey/code-change log"
    ],
    "guidance": {
      "implementation": "Inventory all physical access devices, record issuance and returns, tie recovery into offboarding, and rotate codes on a schedule or after personnel changes.",
      "interview": "“How many keys to this building exist, and where are they?”"
    },
    "sspGuidance": "Describe control of physical access devices: the inventory, issuance/return process, recovery at termination, code rotation practice, who owns it, and the evidence (inventory, records, rotation log).",
    "poamGuidance": "Likely gap: untracked keys and stale codes. Remediation: build the inventory, recover strays, rotate codes. Owner: facility manager. Milestone: inventory reconciled by a set date. Validation evidence: the inventory plus rotation record. A 1-point SPRS requirement."
  },
  "3.10.6": {
    "explanation": "Define safeguards for CUI work done at home or other off-site locations — managed equipment, screen privacy, household access, secure storage — and put them in writing.",
    "commonMistakes": [
      "No telework rules for CUI at all",
      "Work done on family-shared computers",
      "CUI printed at home with no storage or destruction controls"
    ],
    "evidenceExamples": [
      "Telework/alternate work site policy",
      "Signed remote work agreements",
      "Home-setup requirements checklist"
    ],
    "guidance": {
      "implementation": "Write the alternate-site rules: company-managed devices only, screen lock and privacy, no household account sharing, and either prohibit home printing of CUI or define its storage and destruction.",
      "interview": "“What rules apply when an employee works on CUI from home?”"
    },
    "sspGuidance": "Enumerate the safeguards required at alternate work sites (managed device, encryption, screen lock, household access limits, print/storage rules), how they are enforced (policy, MDM, agreements), who owns telework policy, and the evidence (policy, signed agreements).",
    "poamGuidance": "Likely gap: undefined telework safeguards. Remediation: publish the policy and collect signed agreements. Owner: HR with IT Lead. Milestone: policy live and acknowledged by a set date. Validation evidence: policy plus signed acknowledgments. A 1-point SPRS requirement."
  },
  "3.11.1": {
    "explanation": "Periodically step back and assess the risk to your operations, assets, and people from running your systems and handling CUI — what could hurt you, how likely it is, and what you are doing about it.",
    "commonMistakes": [
      "Never done formally — risk lives in people's heads",
      "A one-time assessment now years stale",
      "Findings documented but never acted on"
    ],
    "evidenceExamples": [
      "Risk assessment report with date and method",
      "Risk register with owners and decisions",
      "Evidence that findings drove changes"
    ],
    "guidance": {
      "implementation": "Run a risk assessment at least annually (internally or with [MSP/MSSP] support): identify threats and vulnerabilities, rate likelihood and impact, record decisions in a risk register, and act on the top items.",
      "interview": "“What are your top three security risks right now — and where is that written down?”"
    },
    "sspGuidance": "Describe the risk assessment practice: scope (operations, assets, individuals, CUI processing), method, who performs and owns it (e.g., CIO with [MSP/MSSP]), the cadence (e.g., annual and on major change), where results live (risk register), and the evidence (reports, register, follow-up actions).",
    "poamGuidance": "Likely gap: no periodic, documented risk assessment. Remediation: run the first formal assessment and stand up the register. Owner: CIO. Milestone: assessment complete and register active by a set date. Validation evidence: the report and register. Caution: a 3-point SPRS requirement — close before assessment where practical."
  },
  "3.11.2": {
    "explanation": "Scan your systems and applications for vulnerabilities on a schedule — and again when significant new vulnerabilities are announced. You need a current, honest picture of what is exposed.",
    "commonMistakes": [
      "No vulnerability scanner deployed at all",
      "Scans run annually or only before audits",
      "Scope missing servers, network gear, or anything off-site",
      "Reports generated but never reviewed"
    ],
    "evidenceExamples": [
      "[vulnerability scanner] reports with dates",
      "Scan schedule and scope definition",
      "Coverage list reconciled against the asset inventory"
    ],
    "guidance": {
      "implementation": "Deploy [vulnerability scanner], scan at a defined frequency (monthly is a practical small-business baseline) plus after major vulnerability announcements, and reconcile scan scope against the asset inventory.",
      "interview": "“Show me your most recent vulnerability scan — and what it covered.”"
    },
    "sspGuidance": "State the scanning program: tool ([vulnerability scanner]), frequency, scope (all systems and applications per the inventory), trigger-based scans for new critical vulnerabilities, who runs and reviews scans, and the evidence (reports, schedule, scope reconciliation).",
    "poamGuidance": "Likely gap: no recurring scans. Remediation: deploy the scanner, define schedule and scope, run the first full scan. Owner: IT Lead or [MSP/MSSP]. Milestone: first full-scope scan complete and recurring schedule live by a set date. Validation evidence: scan reports. Caution: a 5-point SPRS requirement — close before assessment."
  },
  "3.11.3": {
    "explanation": "Fix what the scans find, prioritized by risk, on defined timelines. Scanning without remediation is just documenting your exposure.",
    "commonMistakes": [
      "Critical findings open for months",
      "No remediation timelines by severity",
      "Fixes applied but never verified by rescan"
    ],
    "evidenceExamples": [
      "Remediation SLAs by severity",
      "Before/after scan comparison",
      "Remediation tickets in [ticketing system]"
    ],
    "guidance": {
      "implementation": "Set severity-based timelines (e.g., criticals in days, highs in weeks), track fixes in [ticketing system], and verify closure with a rescan.",
      "interview": "“What is your deadline for fixing a critical vulnerability — and do you actually hit it?”"
    },
    "sspGuidance": "State the remediation process: triage from scan results, severity-based timelines, tracking in [ticketing system], rescan verification, who owns remediation, and the evidence (SLAs, tickets, before/after reports).",
    "poamGuidance": "Likely gap: findings accumulate unfixed. Remediation: adopt severity SLAs and work the backlog highest-risk first. Owner: IT Lead or [MSP/MSSP]. Milestone: criticals/highs cleared and SLAs operating by a set date. Validation evidence: rescan showing closure. A 1-point SPRS requirement that makes 3.11.2 actually matter."
  },
  "3.12.1": {
    "explanation": "Periodically assess your own controls — are they in place, operating as intended, and producing the desired result — so problems surface on your schedule, not an assessor's or an attacker's.",
    "commonMistakes": [
      "No self-assessment ever performed",
      "A checklist filled out without testing anything",
      "Findings recorded but never driving fixes or POA&Ms"
    ],
    "evidenceExamples": [
      "Self-assessment report against the NIST SP 800-171A objectives",
      "Assessment schedule",
      "Findings list feeding the POA&M"
    ],
    "guidance": {
      "implementation": "Run an annual self-assessment using the 800-171A assessment objectives as the test script, document what was examined and tested, and convert failures into POA&M items.",
      "interview": "“When did you last check your own controls — and what failed?”"
    },
    "sspGuidance": "Describe the periodic control assessment: scope (all 110 requirements or a rotating subset on a defined cycle), method (against 800-171A objectives), who performs it (internal, [MSP/MSSP], or third party), the cadence, how findings are handled (POA&M), and the evidence (reports, schedule, findings).",
    "poamGuidance": "Likely gap: controls never self-assessed. Remediation: run the first structured self-assessment and feed findings to the POA&M. Owner: CIO or Security lead. Milestone: assessment complete by a set date. Validation evidence: the report plus resulting POA&M entries. Caution: a 5-point SPRS requirement — close before assessment."
  },
  "3.12.2": {
    "explanation": "Keep living plans of action for every known gap — the weakness, the fix, the owner, the date — and actually work the plan down. A POA&M is a managed commitment, not a parking lot.",
    "commonMistakes": [
      "Known gaps with nothing written down",
      "POA&M entries without owners or dates",
      "The document never updated after creation"
    ],
    "evidenceExamples": [
      "POA&M document with milestones and owners",
      "Update history showing regular review",
      "Closed items with closure evidence attached"
    ],
    "guidance": {
      "implementation": "Maintain a POA&M entry for every deficiency: weakness, remediation steps, owner, resources, milestones, completion date. Review it monthly and close items with evidence.",
      "interview": "“Show me your POA&M — when was it last updated, and what closed recently?”"
    },
    "sspGuidance": "State that deficiencies are managed through POA&Ms: where the POA&M lives, what each entry contains (weakness, owner, milestones, dates), who owns the overall document, the review cadence (e.g., monthly), and the evidence (the POA&M, update history, closure records).",
    "poamGuidance": "Likely gap: gaps known but unmanaged. Remediation: stand up the POA&M discipline and populate it from your gap analysis. Owner: CIO. Milestone: POA&M established with all known gaps by a set date. Validation evidence: the document plus a review record. Caution: a 3-point SPRS requirement — and note that under the CMMC rule, POA&Ms at assessment are tightly limited; a POA&M is a management tool, not a substitute for implementation."
  },
  "3.12.3": {
    "explanation": "Monitor your controls on an ongoing basis — recurring checks like access reviews, scan results, log review, and training completion that confirm controls keep working between formal assessments.",
    "commonMistakes": [
      "Controls verified once and assumed good forever",
      "No calendar of recurring checks",
      "Drift discovered only when something breaks"
    ],
    "evidenceExamples": [
      "Continuous monitoring plan/calendar (what, who, how often)",
      "Completed recurring review records",
      "Dashboard or metrics tracking control health"
    ],
    "guidance": {
      "implementation": "Build a simple monitoring calendar — quarterly access reviews, monthly scan and patch reviews, periodic log and training checks — assign owners, and keep the completion records.",
      "interview": "“Which controls get checked monthly or quarterly, and where is the record?”"
    },
    "sspGuidance": "Describe ongoing monitoring: the recurring checks and their frequencies, who performs each, where results are recorded, how failures route to the POA&M, and the evidence (calendar, completed records, metrics).",
    "poamGuidance": "Likely gap: no recurring verification. Remediation: define the monitoring calendar and run the first cycle. Owner: CIO or IT Lead. Milestone: calendar operating with first records by a set date. Validation evidence: completed check records. Caution: a 5-point SPRS requirement — close before assessment."
  },
  "3.12.4": {
    "explanation": "Maintain a System Security Plan that describes your environment and boundary, how each requirement is implemented, and how systems connect. The SSP is the document a CMMC assessment is conducted against — it is the front door of the whole program.",
    "commonMistakes": [
      "No SSP, or a generic template never tailored to the real environment",
      "System boundary and data flows missing or vague",
      "SSP statements contradicting what is actually deployed",
      "Never updated as the environment changed"
    ],
    "evidenceExamples": [
      "Current SSP with revision history",
      "System boundary and network diagrams",
      "Per-requirement implementation statements"
    ],
    "guidance": {
      "implementation": "Write and maintain the SSP: system description, boundary, environment of operation, how each of the 110 requirements is implemented, and connections to other systems. Review it at least annually and on significant change.",
      "interview": "“Does your SSP describe what is actually deployed today — or what you intended a year ago?”"
    },
    "sspGuidance": "The SSP itself should describe the system boundary and environment, enumerate how each requirement is implemented (what, where, who owns it, how enforced, evidence), document interconnections, carry a revision history, and name its owner (e.g., CIO) and review cadence (annual and on change).",
    "poamGuidance": "Likely gap: SSP missing, stale, or contradicting reality. Remediation: author or refresh the SSP against the actual environment, including boundary diagrams and per-requirement statements. Owner: CIO with [MSP/MSSP] support. Milestone: approved current SSP by a set date. Validation evidence: the SSP and its revision record. Caution: the SSP is not point-scored (NA in the scoring annex), but without a current SSP a CMMC assessment cannot proceed at all — treat a missing or stale SSP as an absolute blocker."
  },
  "3.13.1": {
    "explanation": "Guard the edges of your network — and the key internal boundaries — with firewalls, segmentation, and monitored chokepoints around the [CUI enclave]. The boundary is where you decide what gets in and out.",
    "commonMistakes": [
      "A flat network with no internal segmentation at all",
      "Firewall rules accumulated for years and never reviewed",
      "No monitoring of what crosses the boundary"
    ],
    "evidenceExamples": [
      "Network diagram showing boundaries and segments",
      "[firewall platform] rule export with review records",
      "Segmentation/VLAN configuration"
    ],
    "guidance": {
      "implementation": "Define the system boundary, segment the [CUI enclave] from general business systems, restrict traffic at the chokepoints with [firewall platform], and monitor those flows in [SIEM/logging platform].",
      "interview": "“Draw me the line between where CUI lives and everything else — what enforces that line?”"
    },
    "sspGuidance": "Describe boundary protection: the external boundary and key internal boundaries, the enforcing devices ([firewall platform], segmentation), how communications are monitored and controlled at each, who owns boundary configuration, the rule review cadence, and the evidence (diagram, rule exports, monitoring config).",
    "poamGuidance": "Likely gap: flat network with unreviewed rules. Remediation: segment the CUI environment, clean up the ruleset, monitor the chokepoints. Owner: IT Lead or [MSP/MSSP]. Milestone: segmentation live and ruleset reviewed by a set date. Validation evidence: diagram, rule export, segmentation test. Caution: a 5-point SPRS requirement — close before assessment."
  },
  "3.13.2": {
    "explanation": "Build security in by design — segmentation, least privilege, defense in depth — when you architect systems and make changes, rather than bolting protections on after something is already running.",
    "commonMistakes": [
      "Systems stood up ad hoc with no design step",
      "No security review when new services are introduced",
      "No documented architecture to design against"
    ],
    "evidenceExamples": [
      "Architecture documentation",
      "Design/security review records for recent projects",
      "Security requirements in the project or change checklist"
    ],
    "guidance": {
      "implementation": "Document the current architecture, adopt a short list of design principles (segment, least privilege, fail closed, log it), and add a security design review to projects and significant changes.",
      "interview": "“When you added your last new system, who thought about its security design — and where is that recorded?”"
    },
    "sspGuidance": "Describe how architectural designs, development techniques, and engineering principles promote security: the documented architecture, the principles applied, where design review happens (project/change process), who owns architecture (e.g., IT Lead or [MSP/MSSP] architect), and the evidence (architecture docs, review records).",
    "poamGuidance": "Likely gap: no security-by-design practice. Remediation: document the architecture and institute design reviews. Owner: IT Lead. Milestone: architecture documented and review step live by a set date. Validation evidence: the documentation plus a completed review. Caution: a 5-point SPRS requirement — close before assessment."
  },
  "3.13.3": {
    "explanation": "Keep administration separate from everyday use — separate admin interfaces, separate admin accounts, and ideally separate admin workstations or network paths.",
    "commonMistakes": [
      "Admin consoles reachable from any desktop",
      "The same browser session used for admin work and general browsing",
      "No network separation for management traffic"
    ],
    "evidenceExamples": [
      "Access restrictions on admin interfaces",
      "Separate admin account/workstation standard",
      "Management network/VLAN ACLs"
    ],
    "guidance": {
      "implementation": "Restrict management interfaces to admin accounts from designated hosts or a management network, and keep user-facing functionality on a separate path.",
      "interview": "“Can the machine you browse the web on also open the firewall console?”"
    },
    "sspGuidance": "Describe the separation of user and system management functionality: restricted management interfaces, separate admin identities, management network or designated admin hosts, who owns the standard, and the evidence (ACLs, configs, standard).",
    "poamGuidance": "Likely gap: management reachable from anywhere. Remediation: restrict admin interfaces to designated accounts/hosts. Owner: IT Lead. Milestone: restrictions enforced by a set date. Validation evidence: ACL export plus an access test. A 1-point SPRS requirement."
  },
  "3.13.4": {
    "explanation": "Stop information leaking between users through shared system resources — over-shared folders, reassigned equipment that was never wiped, scratch space everyone can read.",
    "commonMistakes": [
      "Shared drives with everyone-access quietly accumulating CUI",
      "Laptops reassigned without reimaging",
      "Temporary or scratch storage world-readable"
    ],
    "evidenceExamples": [
      "Share and folder permission audit",
      "Device reimage-on-reassignment procedure",
      "Multi-user system configuration review"
    ],
    "guidance": {
      "implementation": "Audit shared storage permissions, scope them to need, and make reimaging part of every device reassignment.",
      "interview": "“When a laptop changes hands internally, what happens to the previous user's data?”"
    },
    "sspGuidance": "Describe how unauthorized transfer via shared resources is prevented: permissioned shared storage, device sanitization between users, who owns the checks, the audit cadence, and the evidence (permission audits, reimage records).",
    "poamGuidance": "Likely gap: over-shared storage and unwiped reassignments. Remediation: fix permissions and adopt the reimage rule. Owner: IT Lead. Milestone: audit complete and procedure live by a set date. Validation evidence: permission audit plus reimage records. A 1-point SPRS requirement."
  },
  "3.13.5": {
    "explanation": "Anything publicly reachable — web servers, public portals — must live in a separated subnetwork (a DMZ or isolated cloud segment), physically or logically apart from internal systems and CUI.",
    "commonMistakes": [
      "A public web server sitting on the internal LAN",
      "Port forwards punched through to internal hosts",
      "Cloud-hosted public apps sharing a network with CUI systems"
    ],
    "evidenceExamples": [
      "Network diagram showing the DMZ/isolated segment",
      "[firewall platform] rules isolating the public segment",
      "Cloud network segmentation configuration"
    ],
    "guidance": {
      "implementation": "Place public-facing services in a DMZ or isolated [cloud environment] segment, deny traffic from that segment to internal networks except defined paths, and remove direct forwards to internal hosts.",
      "interview": "“If your public web server were compromised tonight, what could the attacker reach next?”"
    },
    "sspGuidance": "Identify the publicly accessible components and the subnetwork that isolates them, the enforcement ([firewall platform]/cloud segmentation rules), who owns the segment, the review cadence, and the evidence (diagram, rules).",
    "poamGuidance": "Likely gap: public services not isolated. Remediation: build the DMZ/isolated segment and migrate public services into it. Owner: IT Lead or [MSP/MSSP]. Milestone: isolation enforced by a set date. Validation evidence: diagram, rules, and a reachability test. Caution: a 5-point SPRS requirement — close before assessment."
  },
  "3.13.6": {
    "explanation": "Network traffic should be denied by default and allowed only by exception — every open path should be one somebody decided to allow, not one nobody noticed.",
    "commonMistakes": [
      "Permissive any-any rules at the top of the ruleset",
      "Outbound traffic completely open",
      "Temporary allow rules that became permanent"
    ],
    "evidenceExamples": [
      "[firewall platform] ruleset showing default deny inbound and outbound",
      "Documented exceptions with business justification",
      "Periodic rule review records"
    ],
    "guidance": {
      "implementation": "Set default-deny in both directions on [firewall platform], document each allow rule with its justification, and review the ruleset on a schedule.",
      "interview": "“Is your firewall's last rule deny-all — in both directions?”"
    },
    "sspGuidance": "State the deny-all, permit-by-exception posture for network communications, where it is enforced ([firewall platform], cloud security groups), how exceptions are documented and approved, who owns the ruleset, the review cadence, and the evidence (rule exports, review records).",
    "poamGuidance": "Likely gap: permissive defaults, especially outbound. Remediation: implement default-deny and rebuild the exception list deliberately. Owner: IT Lead or [MSP/MSSP]. Milestone: default-deny live by a set date. Validation evidence: ruleset export plus a blocked-traffic test. Caution: a 5-point SPRS requirement — close before assessment."
  },
  "3.13.7": {
    "explanation": "When connected to your network remotely, devices should not simultaneously bridge to other networks in ways that bypass your protections — that is what split tunneling does.",
    "commonMistakes": [
      "Split tunneling enabled on the VPN for convenience",
      "Exceptions made without documenting the risk",
      "No compensating controls where split tunneling is used"
    ],
    "evidenceExamples": [
      "VPN client configuration showing tunnel policy",
      "Remote access standard addressing split tunneling",
      "Risk documentation for any permitted exception"
    ],
    "guidance": {
      "implementation": "Configure [VPN/remote access solution] for full tunnel by default; if split tunneling is ever permitted, document the decision and the compensating controls.",
      "interview": "“While on your VPN, does the laptop's other traffic go through your security stack — or straight to the internet?”"
    },
    "sspGuidance": "State the split-tunneling policy (prevented, or controlled exceptions with compensations), where it is enforced (VPN client config), who owns it, how configuration is verified, and the evidence (config export, standard).",
    "poamGuidance": "Likely gap: split tunneling enabled by default. Remediation: switch to full tunnel or document a controlled exception. Owner: IT Lead. Milestone: policy enforced by a set date. Validation evidence: client config plus a routing test. A 1-point SPRS requirement."
  },
  "3.13.8": {
    "explanation": "Encrypt CUI whenever it crosses networks you do not physically protect — TLS, VPN, encrypted transfer — so interception yields nothing readable.",
    "commonMistakes": [
      "Plain FTP, HTTP, or unencrypted email paths still carrying CUI",
      "Site-to-site links assumed private but not encrypted",
      "No defined mechanism for sending CUI to externals"
    ],
    "evidenceExamples": [
      "TLS configuration on services carrying CUI",
      "[secure file transfer solution] configuration",
      "Email encryption policy and configuration"
    ],
    "guidance": {
      "implementation": "Enforce TLS on every service that moves CUI, provide [secure file transfer solution] for external exchange, encrypt site-to-site links, and give users one sanctioned way to send CUI.",
      "interview": "“Trace one CUI file leaving your network — is every hop encrypted?”"
    },
    "sspGuidance": "Describe transmission protection: the encrypted paths CUI may take (TLS services, VPN, [secure file transfer solution], email encryption), the FIPS-validated modules behind them (cross-reference 3.13.11), who owns transmission security, how unencrypted paths are prevented, and the evidence (configs, policy).",
    "poamGuidance": "Likely gap: unencrypted transmission paths. Remediation: close or encrypt every CUI path and stand up the sanctioned transfer mechanism. Owner: IT Lead or [MSP/MSSP]. Milestone: all CUI paths encrypted by a set date. Validation evidence: configuration exports plus a path walkthrough. Caution: a 3-point SPRS requirement — close before assessment where practical."
  },
  "3.13.9": {
    "explanation": "Network connections tied to sessions should be cut when the session ends or after a defined idle period. Connections that linger after their purpose are loose ends an attacker can pick up.",
    "commonMistakes": [
      "No idle timeouts on VPN, remote desktop, or application sessions",
      "Connections persisting for days unnoticed",
      "Timeouts defined in policy but never configured"
    ],
    "evidenceExamples": [
      "Timeout configuration on VPN/RDP/applications",
      "Session termination policy",
      "Observed disconnect test record"
    ],
    "guidance": {
      "implementation": "Configure end-of-session and inactivity disconnects at the VPN, remote desktop services, and long-lived applications.",
      "interview": "“How long can a dead VPN session stay connected?”"
    },
    "sspGuidance": "State the termination conditions (session end, inactivity threshold) and where they are enforced (gateway and application configs), who owns them, how they are verified, and the evidence (config exports, test record).",
    "poamGuidance": "Likely gap: idle connections never terminated. Remediation: set disconnect timers across gateways and apps. Owner: IT Lead. Milestone: timeouts enforced by a set date. Validation evidence: configs plus an observed disconnect. A 1-point SPRS requirement."
  },
  "3.13.10": {
    "explanation": "Manage cryptographic keys deliberately — who creates them, where they are stored, how they are rotated and destroyed — for everything from disk-encryption recovery keys to TLS certificates.",
    "commonMistakes": [
      "Recovery keys scattered in random places",
      "Certificates expiring unnoticed",
      "No inventory of keys and certificates",
      "Former admins still knowing static secrets"
    ],
    "evidenceExamples": [
      "Key and certificate inventory",
      "Key storage/escrow configuration (e.g., recovery keys escrowed to [identity provider] or a vault)",
      "Rotation and expiry tracking records"
    ],
    "guidance": {
      "implementation": "Inventory keys and certificates, escrow recovery keys centrally, track certificate expiry, and define rotation — especially after personnel changes.",
      "interview": "“Where are your disk-encryption recovery keys, and who can read them?”"
    },
    "sspGuidance": "Describe key management: the key/cert inventory, storage and escrow locations, rotation and destruction practices, who owns key management, the review cadence, and the evidence (inventory, escrow config, rotation records).",
    "poamGuidance": "Likely gap: keys unmanaged and untracked. Remediation: build the inventory, centralize escrow, set rotation rules. Owner: IT Lead. Milestone: inventory and escrow complete by a set date. Validation evidence: inventory plus escrow configuration. A 1-point SPRS requirement."
  },
  "3.13.11": {
    "explanation": "When encryption is what protects the confidentiality of CUI, the cryptographic modules must be FIPS 140-validated. This is stricter than it sounds: using AES is not the same as using a FIPS-validated module, and assessors check the difference.",
    "commonMistakes": [
      "Assuming any AES-based encryption qualifies",
      "FIPS mode available but never enabled",
      "No record of CMVP certificate numbers",
      "Vendor marketing claims accepted without verification"
    ],
    "evidenceExamples": [
      "CMVP certificate numbers mapped to each product protecting CUI",
      "FIPS mode configuration evidence",
      "Crypto inventory mapping CUI flows/storage to validated modules"
    ],
    "guidance": {
      "implementation": "Inventory every place cryptography protects CUI (disk, transit, backups, media), verify each module against the NIST CMVP list, record certificate numbers, and enable FIPS mode where required.",
      "interview": "“For each place you encrypt CUI, can you point to the FIPS 140 certificate number?”"
    },
    "sspGuidance": "List where FIPS-validated cryptography is employed (at-rest, in-transit, media, backups), the specific modules and CMVP certificate numbers, who owns crypto compliance, how new systems are checked before adoption, and the evidence (crypto inventory, certificates, FIPS-mode configs).",
    "poamGuidance": "Likely gap: encryption present but validation unverified. Remediation: build the crypto inventory, verify modules on the CMVP list, enable FIPS mode, replace what cannot comply. Owner: IT Lead or [MSP/MSSP]. Milestone: all CUI-protecting crypto validated by a set date. Validation evidence: inventory with certificate numbers. Caution: weighted up to 5 SPRS points and one of the most common assessment stumbling blocks — investigate early; module replacement can take time."
  },
  "3.13.12": {
    "explanation": "Cameras and microphones in conference and collaboration systems must not be remotely activatable without clear indication, and people in the room should know when they are live.",
    "commonMistakes": [
      "Conference gear remotely reachable with default credentials",
      "No policy on activation indicators",
      "Unmanaged webcams and room systems in areas where CUI is discussed"
    ],
    "evidenceExamples": [
      "Collaborative device inventory and configuration",
      "Settings showing use indicators and remote-activation restrictions",
      "Conference system management policy"
    ],
    "guidance": {
      "implementation": "Inventory room systems and webcams, harden their admin access, verify activation indicators work, and disable remote activation features you do not need.",
      "interview": "“Could anyone turn on a conference-room microphone remotely without the room knowing?”"
    },
    "sspGuidance": "State the controls over collaborative computing devices: no remote activation without indication, hardened management access, who owns these devices, how they are reviewed, and the evidence (inventory, configs).",
    "poamGuidance": "Likely gap: unmanaged conference devices. Remediation: inventory, harden, and verify indicators. Owner: IT Lead. Milestone: devices secured by a set date. Validation evidence: configuration review. A 1-point SPRS requirement."
  },
  "3.13.13": {
    "explanation": "Control mobile code — macros, scripts, and active content that arrives and executes — by defining what is allowed and technically blocking the rest. Unrestricted Office macros remain a top ransomware entry point.",
    "commonMistakes": [
      "Macros from the internet allowed to run",
      "Browser extensions and scripts unmanaged",
      "No policy defining acceptable mobile code"
    ],
    "evidenceExamples": [
      "Macro policy configuration from [endpoint management platform]",
      "Browser script/extension policy export",
      "Mobile code policy document"
    ],
    "guidance": {
      "implementation": "Block macros in files from the internet via [endpoint management platform] policy, manage browser extensions centrally, and document what mobile code is authorized.",
      "interview": "“What happens when a user opens an emailed spreadsheet with macros?”"
    },
    "sspGuidance": "Define authorized mobile code and the technical controls over the rest (macro blocking, extension management), where enforced, who owns the policy, the review cadence, and the evidence (policy exports).",
    "poamGuidance": "Likely gap: macros and active content unrestricted. Remediation: deploy macro blocking and extension management. Owner: IT Lead. Milestone: controls enforced by a set date. Validation evidence: policy export plus a blocked-macro test. A 1-point SPRS requirement with outsized ransomware relevance."
  },
  "3.13.14": {
    "explanation": "Treat phone-over-network (VoIP) like any other networked application — control and monitor it, segment voice traffic, and harden the platform that runs it.",
    "commonMistakes": [
      "VoIP on the same network segment as CUI systems",
      "Default admin credentials on the phone system",
      "No monitoring of the voice platform at all"
    ],
    "evidenceExamples": [
      "[VoIP platform] configuration export",
      "Voice VLAN/segmentation configuration",
      "Admin access controls on the phone system"
    ],
    "guidance": {
      "implementation": "Put voice on its own segment, harden [VoIP platform] admin access, and include it in patching and monitoring scope.",
      "interview": "“Who administers your phone system — and could it reach your file servers?”"
    },
    "sspGuidance": "Describe VoIP controls: segmentation, hardened administration, monitoring, who owns the platform, the review cadence, and the evidence (configs, segment diagram).",
    "poamGuidance": "Likely gap: unmanaged, unsegmented VoIP. Remediation: segment voice and harden the platform. Owner: IT Lead. Milestone: controls live by a set date. Validation evidence: configuration plus segmentation test. A 1-point SPRS requirement."
  },
  "3.13.15": {
    "explanation": "Protect the authenticity of communications sessions so they cannot be hijacked or spoofed — modern TLS with valid certificates protects both the privacy and the identity of a connection.",
    "commonMistakes": [
      "Legacy TLS/SSL versions still accepted",
      "Self-signed certificates everywhere, training users to click through warnings",
      "Internal services running unauthenticated protocols"
    ],
    "evidenceExamples": [
      "TLS version and cipher policy",
      "Certificate management records",
      "Protocol scan showing legacy versions disabled"
    ],
    "guidance": {
      "implementation": "Enforce TLS 1.2 or higher with valid certificates on all services, disable legacy protocol versions, and fix the internal services that teach users to ignore certificate warnings.",
      "interview": "“Do any of your systems still accept TLS 1.0 — or present untrusted certificates?”"
    },
    "sspGuidance": "State how session authenticity is protected (modern TLS, valid certificates, signed/authenticated protocols), where enforced, who owns protocol and certificate policy, how verified (scans), and the evidence (policy, scan results, cert records).",
    "poamGuidance": "Likely gap: legacy protocols and untrusted certs. Remediation: enforce modern TLS and clean up certificates. Owner: IT Lead or [MSP/MSSP]. Milestone: legacy disabled and certs valid by a set date. Validation evidence: protocol scan. Caution: a 5-point SPRS requirement — close before assessment."
  },
  "3.13.16": {
    "explanation": "Protect the confidentiality of CUI wherever it sits at rest — encryption at rest plus tight access controls on servers, endpoints, and cloud storage. Know every place CUI rests, then verify each is covered.",
    "commonMistakes": [
      "Assuming the cloud is encrypted without checking the actual settings",
      "On-prem file servers without at-rest encryption",
      "Forgotten locations — NAS boxes, archives, old shares — outside the plan"
    ],
    "evidenceExamples": [
      "Encryption-at-rest configurations ([cloud environment] settings, disk encryption reports)",
      "Storage inventory mapping where CUI rests",
      "Access control review for CUI storage locations"
    ],
    "guidance": {
      "implementation": "Map every at-rest location of CUI from the data flow work, verify encryption at rest on each (with FIPS-validated modules where encryption is the protection), and pair it with strict access permissions.",
      "interview": "“List every place CUI is stored — is each encrypted at rest, and how do you know?”"
    },
    "sspGuidance": "List where CUI rests and how confidentiality is protected at each location (encryption mechanism and module, access controls), who owns storage security, how coverage is reviewed against the data inventory, and the evidence (configs, inventory, access reviews).",
    "poamGuidance": "Likely gap: unverified or missing at-rest protection. Remediation: complete the storage inventory and close each unencrypted location. Owner: IT Lead. Milestone: all CUI-at-rest locations protected by a set date. Validation evidence: per-location configuration evidence. A 1-point SPRS requirement, but central to the CUI story."
  },
  "3.14.1": {
    "explanation": "Identify, report, and fix system flaws — operating systems, applications, and firmware — within defined timeframes. Unpatched known vulnerabilities remain the most common way organizations get breached.",
    "commonMistakes": [
      "Patching ad hoc with no defined timelines",
      "Third-party applications and firmware left out of the cycle",
      "No verification that patches actually applied"
    ],
    "evidenceExamples": [
      "Patch policy with timelines by severity",
      "Patch compliance reports from [endpoint management platform]",
      "Firmware update records"
    ],
    "guidance": {
      "implementation": "Run a defined patch cycle (e.g., monthly, with expedited handling for critical flaws) through [endpoint management platform], include third-party apps and firmware, and verify compliance with reports.",
      "interview": "“A critical patch came out on Tuesday — what is your process and your deadline?”"
    },
    "sspGuidance": "Describe flaw remediation: how flaws are identified (advisories, scans), the remediation timelines by severity, the tooling ([endpoint management platform]), scope (OS, third-party, firmware), who owns patching, how compliance is verified and how often, and the evidence (policy, compliance reports).",
    "poamGuidance": "Likely gap: no timely, verified patching. Remediation: define the cycle and SLAs, automate via [endpoint management platform], clear the backlog. Owner: IT Lead or [MSP/MSSP]. Milestone: fleet at target compliance by a set date. Validation evidence: compliance report. Caution: a 5-point SPRS requirement — close before assessment."
  },
  "3.14.2": {
    "explanation": "Run malicious code protection at the right places — endpoints, servers, and the email gateway — so malware is caught where it enters and where it would execute.",
    "commonMistakes": [
      "Servers running without endpoint protection",
      "Email filtering absent or left at defaults",
      "Coverage gaps invisible because nobody reports on them"
    ],
    "evidenceExamples": [
      "[EDR solution] deployment/coverage report",
      "Email security gateway configuration",
      "A sample detection and its handling"
    ],
    "guidance": {
      "implementation": "Deploy [EDR solution] to every endpoint and server, enable email filtering in front of mailboxes, and watch the coverage report for machines that fall out.",
      "interview": "“What percentage of your machines is running endpoint protection right now — and how do you know?”"
    },
    "sspGuidance": "State where malicious code protection operates (endpoints, servers, email gateway), the products ([EDR solution], email filter), who owns them, how coverage is monitored and how often, and the evidence (coverage reports, gateway config).",
    "poamGuidance": "Likely gap: partial coverage, especially servers and email. Remediation: deploy to all systems and enable mail filtering. Owner: IT Lead or [MSP/MSSP]. Milestone: full coverage by a set date. Validation evidence: coverage report. Caution: a 5-point SPRS requirement — close before assessment."
  },
  "3.14.3": {
    "explanation": "Track security alerts and advisories — CISA, vendors, your [MSP/MSSP] feeds — and actually act on them: decide if they apply, then patch, mitigate, or document why not.",
    "commonMistakes": [
      "Nobody assigned to watch advisories",
      "Alerts read with no action or record",
      "Relevant advisories discovered weeks later from the news"
    ],
    "evidenceExamples": [
      "Advisory subscription list (CISA, vendors)",
      "Triage records linking advisories to actions",
      "An example advisory-driven ticket in [ticketing system]"
    ],
    "guidance": {
      "implementation": "Assign an owner for advisory monitoring, subscribe to CISA and your vendors, and triage each relevant advisory into an action or a documented no-action decision in [ticketing system].",
      "interview": "“Who read the last CISA advisory relevant to your stack — and what did they do about it?”"
    },
    "sspGuidance": "Describe how alerts and advisories are monitored (sources, owner), how applicability is assessed, how responses are tracked ([ticketing system]), the cadence, and the evidence (subscriptions, triage records).",
    "poamGuidance": "Likely gap: advisories nobody owns. Remediation: assign the duty, set up feeds, start the triage log. Owner: IT Lead or [MSP/MSSP]. Milestone: process operating by a set date. Validation evidence: triage records. Caution: a 5-point SPRS requirement — close before assessment."
  },
  "3.14.4": {
    "explanation": "Malware protection only works when current — signatures, detection engines, and agents must update automatically, and you must catch the machines where updating silently fails.",
    "commonMistakes": [
      "Outdated agents quietly failing for months",
      "Updates depending on manual action",
      "No report showing stale protection"
    ],
    "evidenceExamples": [
      "[EDR solution] update status report",
      "Auto-update configuration",
      "Remediation records for stale agents"
    ],
    "guidance": {
      "implementation": "Enforce automatic updates in [EDR solution], alert on agents that go stale, and remediate them on a defined clock.",
      "interview": "“How many machines have out-of-date protection today?”"
    },
    "sspGuidance": "State that protection mechanisms update automatically, where that is configured ([EDR solution] policy), who monitors update health and how often, and the evidence (update status reports, remediation records).",
    "poamGuidance": "Likely gap: stale agents unnoticed. Remediation: enforce auto-update and stand up staleness alerting. Owner: IT Lead or [MSP/MSSP]. Milestone: fleet current with alerting live by a set date. Validation evidence: update status report. Caution: a 5-point SPRS requirement — close before assessment."
  },
  "3.14.5": {
    "explanation": "Scan systems periodically, and scan files from external sources in real time as they arrive — downloads, email attachments, USB content.",
    "commonMistakes": [
      "Real-time protection disabled for performance reasons",
      "Periodic full scans never scheduled",
      "Exclusion lists so broad they swallow whole drives"
    ],
    "evidenceExamples": [
      "Scan policy configuration in [EDR solution]",
      "Scheduled scan logs",
      "Real-time protection status report and exclusion review"
    ],
    "guidance": {
      "implementation": "Enable real-time scanning everywhere, schedule periodic scans, and audit the exclusion list down to what is justified.",
      "interview": "“Is real-time scanning on for every machine — and what has been excluded?”"
    },
    "sspGuidance": "State the scanning regime (real-time on external files, periodic full scans and their schedule), where configured ([EDR solution] policy), who owns it, how exclusions are controlled and reviewed, and the evidence (policy, scan logs, exclusion review).",
    "poamGuidance": "Likely gap: real-time off or periodic scans absent. Remediation: enforce both via policy and clean up exclusions. Owner: IT Lead. Milestone: policy enforced fleet-wide by a set date. Validation evidence: policy export plus status report. Caution: a 3-point SPRS requirement."
  },
  "3.14.6": {
    "explanation": "Watch network traffic and system behavior for attacks and indicators of compromise — inbound, outbound, and lateral. Monitoring that nobody looks at is not monitoring.",
    "commonMistakes": [
      "Nobody watching outside business hours",
      "Outbound traffic unmonitored — the exfiltration blind spot",
      "Alerts generated but routinely ignored"
    ],
    "evidenceExamples": [
      "Detection/alerting configuration in [SIEM/logging platform] and [EDR solution]",
      "Alert handling records",
      "[MSP/MSSP] SOC agreement if monitoring is outsourced"
    ],
    "guidance": {
      "implementation": "Enable network and endpoint detections, monitor inbound and outbound traffic at the boundary, and make sure a named human or [MSP/MSSP] SOC owns responding to alerts around the clock.",
      "interview": "“Who saw your security alerts last Saturday?”"
    },
    "sspGuidance": "Describe attack monitoring: what is watched (network boundary in/out, endpoints), the tooling ([SIEM/logging platform], [EDR solution]), who responds and on what coverage model (internal or [MSP/MSSP] SOC), the review cadence, and the evidence (detection configs, alert handling records, SOC agreement).",
    "poamGuidance": "Likely gap: detections exist but nobody owns response. Remediation: define the monitoring/response model, consider an [MSP/MSSP] SOC for after-hours. Owner: CIO or IT Lead. Milestone: monitoring with owned response live by a set date. Validation evidence: alert handling records. Caution: a 5-point SPRS requirement — close before assessment."
  },
  "3.14.7": {
    "explanation": "Be able to spot unauthorized use of your systems — odd-hours activity, impossible-travel sign-ins, unusual data movement — by defining what authorized use looks like and alerting on deviations.",
    "commonMistakes": [
      "No definition of what normal/authorized use is",
      "Sign-in anomalies generated but never reviewed",
      "Service accounts behaving strangely with nobody noticing"
    ],
    "evidenceExamples": [
      "Anomaly/risk detection configuration in [identity provider] or [SIEM/logging platform]",
      "Investigation records for flagged events",
      "Definition of authorized use (policy or baseline)"
    ],
    "guidance": {
      "implementation": "Enable identity risk detections (impossible travel, unfamiliar sign-ins) and behavioral alerts in [SIEM/logging platform], define authorized use so deviations are recognizable, and review flags on a schedule.",
      "interview": "“Would you notice a sign-in from overseas on a Sunday night?”"
    },
    "sspGuidance": "State how unauthorized use is identified: the definition of authorized use, the detections in place ([identity provider] risk events, [SIEM/logging platform] anomalies), who reviews and investigates and how often, and the evidence (detection configs, investigation records).",
    "poamGuidance": "Likely gap: anomalies invisible or ignored. Remediation: enable detections and assign review. Owner: IT Lead or [MSP/MSSP]. Milestone: detections live with review cadence by a set date. Validation evidence: configs plus an investigation record. Caution: a 3-point SPRS requirement."
  }
};

export const CONTROL_LIBRARY: Control[] = GENERATED_CONTROLS.map((c) => {
  const o = BF_OVERLAY[c.number];
  return o ? { ...c, ...o } : c;
});

export const CONTROLS_BY_ID: Record<string, Control> = Object.fromEntries(
  CONTROL_LIBRARY.map((c) => [c.id, c]),
);

/** NIST SP 800-171 Rev. 2 has 110 security requirements. */
export const EXPECTED_CONTROL_COUNT = 110;
/** False until the full 110-requirement library is loaded (drives the incomplete-library banner). */
export const LIBRARY_COMPLETE = CONTROL_LIBRARY.length >= EXPECTED_CONTROL_COUNT;

/* ---- family summary for the Control Library screen ---- */
export interface FamilySummary {
  code: string;
  name: string;
  count: number;
  l1Count: number;
}
export const FAMILIES: FamilySummary[] = CONTROL_FAMILIES.map((f) => {
  const inFam = CONTROL_LIBRARY.filter((c) => c.familyCode === f.code);
  return {
    code: f.code,
    name: f.name,
    count: inFam.length,
    l1Count: inFam.filter((c) => c.level === 'L1').length,
  };
});

/* ---- active client's assessments: default for all 110 + worked subset ---- */
type ARow = [string, ReadinessStatus, SspStatus, EvidenceStatus, PoamStatus, RiskLevel, Owner];

const WORKED: ARow[] = [
  ['3.1.1', 'Met', 'Complete', 'Accepted', 'None', 'Low', 'IT Lead'],
  ['3.1.2', 'Partial', 'Needs Fix', 'Needs Revision', 'Ongoing', 'Medium', 'IT Lead'],
  ['3.1.3', 'Not Met', 'Missing', 'Missing', 'Blocked', 'Critical', 'CIO'],
  ['3.1.5', 'Partial', 'Needs Fix', 'In Review', 'Ongoing', 'Medium', 'IT Lead'],
  ['3.1.12', 'Met', 'Complete', 'Accepted', 'None', 'Low', 'MSP'],
  ['3.1.20', 'Not Met', 'Missing', 'Missing', 'Not Started', 'Medium', 'MSP'],
  ['3.1.22', 'Met', 'Complete', 'Accepted', 'None', 'Low', 'IT Lead'],
  ['3.2.1', 'Met', 'Complete', 'Accepted', 'None', 'Low', 'HR / IT'],
  ['3.2.2', 'Partial', 'Needs Fix', 'In Review', 'Ongoing', 'Medium', 'HR / IT'],
  ['3.3.1', 'Not Met', 'Needs Fix', 'Missing', 'Blocked', 'High', 'CIO'],
  ['3.3.2', 'Partial', 'Needs Fix', 'In Review', 'Ongoing', 'Medium', 'MSP'],
  ['3.4.1', 'Met', 'Complete', 'Accepted', 'None', 'Low', 'MSP'],
  ['3.4.2', 'Met', 'Complete', 'Accepted', 'None', 'Low', 'IT Lead'],
  ['3.4.6', 'Partial', 'Needs Fix', 'In Review', 'Ongoing', 'Medium', 'MSP'],
  ['3.5.1', 'Met', 'Complete', 'Accepted', 'None', 'Low', 'IT Lead'],
  ['3.5.2', 'Met', 'Complete', 'Accepted', 'None', 'Low', 'IT Lead'],
  ['3.5.3', 'Partial', 'Complete', 'In Review', 'Ongoing', 'High', 'IT Lead'],
  ['3.5.10', 'Met', 'Complete', 'Accepted', 'None', 'Low', 'IT Lead'],
  ['3.6.1', 'Not Met', 'Missing', 'Missing', 'Not Started', 'High', 'Security'],
  ['3.7.1', 'Met', 'Complete', 'Accepted', 'None', 'Low', 'MSP'],
  ['3.8.1', 'Met', 'Complete', 'Accepted', 'None', 'Low', 'IT Lead'],
  ['3.8.3', 'Not Met', 'Missing', 'Missing', 'Not Started', 'Medium', 'IT Lead'],
  ['3.10.1', 'Met', 'Complete', 'Accepted', 'None', 'Low', 'IT Lead'],
  ['3.10.3', 'Met', 'Complete', 'Accepted', 'None', 'Low', 'IT Lead'],
  ['3.11.2', 'Partial', 'Needs Fix', 'In Review', 'Ongoing', 'Medium', 'MSP'],
  ['3.12.4', 'Partial', 'Needs Fix', 'In Review', 'Ongoing', 'Medium', 'CIO'],
  ['3.13.1', 'Met', 'Complete', 'Accepted', 'None', 'Low', 'MSP'],
  ['3.13.8', 'Met', 'Complete', 'Accepted', 'None', 'Low', 'MSP'],
  ['3.13.11', 'Not Met', 'Missing', 'Missing', 'Blocked', 'High', 'MSP'],
  ['3.14.1', 'Partial', 'Needs Fix', 'In Review', 'Ongoing', 'Medium', 'MSP'],
  ['3.14.2', 'Met', 'Complete', 'Accepted', 'None', 'Low', 'MSP'],
  ['3.14.4', 'Met', 'Complete', 'Accepted', 'None', 'Low', 'MSP'],
];

const WORKED_BY_ID = new Map(WORKED.map((r) => [r[0], r]));

const SSP_STATEMENTS: Record<string, string> = {
  '3.1.1':
    'Access to CUI systems is restricted to authorized personnel via Entra ID role-based groups, with device compliance enforced through Intune. Reviewed quarterly.',
  '3.5.3':
    'Phishing-resistant MFA is enforced for all CUI applications through Conditional Access. Privileged accounts require hardware security keys.',
};

export const SEED_ASSESSMENTS: ClientControlAssessment[] = CONTROL_LIBRARY.map((c) => {
  const w = WORKED_BY_ID.get(c.number);
  if (w) {
    const [, status, sspStatus, evidenceStatus, poamStatus, risk, owner] = w;
    return {
      clientId: DEMO_CLIENT_ID,
      controlId: c.id,
      status,
      sspStatus,
      evidenceStatus,
      poamStatus,
      risk,
      owner,
      dueDate: '08/15/2026',
      lastReviewed: 'Jul 1, 2026',
      sspStatement: SSP_STATEMENTS[c.number],
      consultantNotes:
        c.number === '3.1.1' ? 'RBAC enforced via Entra ID groups. Verified Jul 1.' : undefined,
    };
  }
  // default: not yet reviewed
  return {
    clientId: DEMO_CLIENT_ID,
    controlId: c.id,
    status: 'Not Reviewed',
    sspStatus: 'Not Reviewed',
    evidenceStatus: 'Not Requested',
    poamStatus: 'None',
    risk: 'Medium',
    owner: 'Unassigned',
  };
});
