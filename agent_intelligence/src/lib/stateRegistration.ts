// stateRegistration.ts
//
// Per-state employer REGISTRATION links for the office summary's
// out-of-state remote-employee guide: where an agency owner obtains the
// state withholding account and unemployment-insurance account that
// payroll software (QuickBooks etc.) requires BEFORE it can calculate and
// file that state's taxes. Registering is the step the software does not
// do — and the one small employers most often miss.
//
// These are USER-FACING browser links (never generator-fetched), so the
// verification bar is "the correct official government page", and pages
// that bot-block automated fetchers are fine here. Populated from the
// 2026-07 registration-link harvest; official government domains only.

import type { StateCode } from "./resourceUrls";

export type RegistrationInfo = {
  // Where to register for an employer income-tax WITHHOLDING account.
  // null for the nine states with no wage income tax (see note).
  withholding: string | null;
  // Where to register for a state UNEMPLOYMENT INSURANCE employer account.
  unemployment: string | null;
  // A single official portal that registers both, where one exists
  // (MyBizColorado, NJ business registration, MD Combined Registration...).
  combined?: string;
  // Load-bearing caveat only (no-income-tax, combined portal, quirks).
  note?: string;
};

// The nine states with no state income tax on wages — no withholding
// account exists to register for. (WA/AK still have other employer
// payroll programs; per-state notes carry that.)
export const NO_WAGE_INCOME_TAX_STATES: ReadonlySet<string> = new Set([
  "AK", "FL", "NV", "NH", "SD", "TN", "TX", "WA", "WY",
]);

// Filled by the registration-link harvest (assembled 2026-07). States
// without an entry render the guide row with the no-links fallback copy.
export const REGISTRATION_LINKS: Partial<Record<StateCode, RegistrationInfo>> = {
  AK: {
    withholding: null,
    unemployment: "https://labor.alaska.gov/estax/",
    note: "No state income tax on wages. Online UI employer registration is via myAlaska (my.alaska.gov) > Services for Businesses > Employment Security Tax > New Registration; the ES Tax page is the employer-facing entry point.",
  },
  AL: {
    withholding: "https://myalabamataxes.alabama.gov/",
    unemployment: "https://labor.alabama.gov/uc/employer.aspx",
    note: "Withholding via My Alabama Taxes 'Register a business/Obtain a New Tax Account Number'; UI account registered online through the AL Dept of Labor UC employer page.",
  },
  AR: {
    withholding: "https://atap.arkansas.gov/",
    unemployment: "https://www.workforce.arkansas.gov/Tax21/Home.aspx",
    note: "Withholding via ATAP 'Register a Business'; UI via ADWS EZ Tax Registration (Tax21) — confirmed as the destination of the official portal.arkansas.gov UI-tax-employer-registration service page.",
  },
  AZ: {
    withholding: "https://azdor.gov/business/withholding-tax",
    unemployment: "https://des.az.gov/content/applying-unemployment-insurance-tax-account-number",
    combined: "https://www.aztaxes.gov/",
    note: "Combined portal: the Joint Tax Application (JT-1/UC-001) filed on AZTaxes.gov registers the employer for DOR withholding and DES unemployment insurance at the same time.",
  },
  CA: {
    withholding: "https://edd.ca.gov/en/payroll_taxes/employers-payroll-tax-account-registration/",
    unemployment: "https://edd.ca.gov/en/payroll_taxes/employers-payroll-tax-account-registration/",
    combined: "https://edd.ca.gov/en/payroll_taxes/e-Services_for_Business/",
    note: "Single-agency state: EDD administers both PIT withholding and UI through one employer payroll tax account, registered via e-Services for Business.",
  },
  CO: {
    withholding: "https://tax.colorado.gov/withholding-accounts",
    unemployment: "https://cdle.colorado.gov/employers/starting-a-business",
    combined: "https://mybiz.colorado.gov/",
    note: "MyBizColorado registers both the DOR wage withholding account and the CDLE unemployment insurance (MyUI Employer+) account in one flow.",
  },
  CT: {
    withholding: "https://portal.ct.gov/drs/withholding-taxes/new-employer-information",
    unemployment: "https://reemployct.dol.ct.gov/",
    note: "Withholding registered with DRS via myconneCT ('New Business/Need a CT Registration Number?'); UI registered separately with CTDOL via ReEmployCT ('New Employer Registration — Apply Here').",
  },
  DE: {
    withholding: "https://onestop.delaware.gov/Operate_Register",
    unemployment: "https://labor.delaware.gov/divisions/unemployment-insurance/employer-services/",
    combined: "https://onestop.delaware.gov/",
    note: "Delaware One Stop's Combined Registration Application (Form CRA) covers both the Division of Revenue withholding account and the DOL unemployment insurance account; separate IDs issued by each agency.",
  },
  FL: {
    withholding: null,
    unemployment: "https://floridarevenue.com/taxes/eservices/Pages/registration.aspx",
    note: "No state income tax on wages. UI is Florida 'reemployment tax' administered by the Dept of Revenue (not a labor agency); register via the online Florida Business Tax Application (DR-1).",
  },
  GA: {
    withholding: "https://gtc.dor.ga.gov/",
    unemployment: "https://dol.georgia.gov/online-services",
    note: "Withholding via Georgia Tax Center; UI via GA DOL's Online Employer Tax Registration (listed under Online Services; direct service entry at dol.state.ga.us).",
  },
  HI: {
    withholding: "https://hitax.hawaii.gov/",
    unemployment: "https://labor.hawaii.gov/ui/new-employer-registration/",
    note: "Withholding via Hawaii Tax Online (Form BB-1 registration); UI registration (Form UC-1) completed in the DLIR employer web application at uiclaims.hawaii.gov, linked from the New Employer Registration page.",
  },
  IA: {
    withholding: "https://govconnect.iowa.gov/",
    unemployment: "https://www.myiowaui.org/",
    note: "Withholding via GovConnectIowa 'Register for New Business'; UI via Iowa Workforce Development's myIowaUI system (myiowaui.org is the state's official IWD portal domain).",
  },
  ID: {
    withholding: "https://tax.idaho.gov/online-services/business-registration/",
    unemployment: "https://www2.labor.idaho.gov/IBRS",
    combined: "https://www2.labor.idaho.gov/IBRS",
    note: "Combined portal: one Idaho Business Registration (IBR) application registers the employer with the State Tax Commission (withholding) and the Dept of Labor (UI).",
  },
  IL: {
    withholding: "https://mytax.illinois.gov/",
    unemployment: "https://ides.illinois.gov/employer-resources/taxes-reporting/are-you-a-new-employer-register.html",
    combined: "https://mytax.illinois.gov/",
    note: "Combined portal: MyTax Illinois 'Register a New Business (Form REG-1)' registers IDOR withholding and IDES unemployment insurance together.",
  },
  IN: {
    withholding: "https://inbiz.in.gov/taxes-fees/tax-registration",
    unemployment: "https://www.in.gov/dwd/indiana-unemployment/employers/ess",
    note: "Withholding account via INBiz (managed afterward in INTIME); UI account via DWD Uplink Employer Self Service.",
  },
  KS: {
    withholding: "https://www.kdor.ks.gov/Apps/KCSC/Registration.aspx",
    unemployment: "https://www.dol.ks.gov/employers/employer-services",
    note: "Withholding via the KDOR Customer Service Center business tax registration; UI via KDOL employer services (kansasemployer.gov 301-redirects to this page).",
  },
  KY: {
    withholding: "https://revenue.ky.gov/Business/Pages/Employer-Payroll-Withholding.aspx",
    unemployment: "https://kewes.ky.gov/",
    combined: "https://onestop.ky.gov/",
    note: "Kentucky Business One Stop handles business/tax registration including DOR withholding; the UI employer account (KEIN) is serviced through the Office of Unemployment Insurance's KEWES self-service portal.",
  },
  LA: {
    withholding: "https://latap.revenue.louisiana.gov/_/",
    unemployment: "https://laors9.laworks.net/lastarsregistration",
    note: "Withholding account is opened via LaTAP (LA Dept of Revenue portal); UI via LWC's online Employer Registration Application.",
  },
  MA: {
    withholding: "https://www.mass.gov/how-to/register-your-business-with-masstaxconnect",
    unemployment: "https://www.mass.gov/how-to/register-my-business-with-dua",
    note: "Two separate registrations: DOR via MassTaxConnect (withholding + PFML), then DUA for UI after first payroll.",
  },
  MD: {
    withholding: "https://mdtaxconnect.gov/rptp/portal/business/register-new-business/",
    unemployment: "https://labor.maryland.gov/unemployment-insurance/employer-agent/new-employer-get-started.shtml",
    combined: "https://mdtaxconnect.gov/rptp/portal/business/register-new-business/",
    note: "MD Combined Registration Application (now on Maryland Tax Connect) covers withholding and can initiate UI; UI account is administered in the BEACON portal (labor.maryland.gov page has registration steps).",
  },
  ME: {
    withholding: "https://revenue.maine.gov/_/",
    unemployment: "https://www.maine.gov/unemployment/employers/",
    note: "Withholding: 'Register a New Business' on the Maine Tax Portal. UI: employer page links to registration in ReEmployME (maine.gov/reemployme).",
  },
  MI: {
    withholding: "https://www.michigan.gov/taxes/business-taxes/new-biz/online-business-registration",
    unemployment: "https://www.michigan.gov/leo/bureaus-agencies/uia/employers",
    combined: "https://www.michigan.gov/taxes/business-taxes/new-biz/online-business-registration",
    note: "Michigan e-Registration (via Michigan Treasury Online) registers both Treasury withholding and the UIA employer account. michigan.gov returns 403 to automated fetchers but loads in browsers.",
  },
  MN: {
    withholding: "https://www.mndor.state.mn.us/tp/eservices/_/",
    unemployment: "https://www.uimn.org/employers/help-and-support/emp-hbook/new-registration.jsp",
    note: "Withholding: register for a Minnesota Tax ID in DOR e-Services (link confirmed from revenue.state.mn.us New Employer Guide). UI: register at uimn.org (also covers MN Paid Leave).",
  },
  MO: {
    withholding: "https://dor.mo.gov/register-business/",
    unemployment: "https://uinteract.labor.mo.gov/",
    note: "UI registration is completed inside UInteract (create account, then register for an unemployment tax account).",
  },
  MS: {
    withholding: "https://tap.dor.ms.gov/_/",
    unemployment: "https://mdes.ms.gov/employers/unemployment-tax/",
    note: "Withholding: 'Register for Taxes' on Mississippi TAP. UI: MDES unemployment tax page links to online employer registration.",
  },
  MT: {
    withholding: "https://tap.dor.mt.gov/_/",
    unemployment: "https://uieservices.mt.gov/",
    note: "Withholding: 'Register for a New Tax Account' on the Montana TransAction Portal (TAP). UI: register via UI eServices for Employers.",
  },
  NC: {
    withholding: "https://eservices.dor.nc.gov/ncbusreg/",
    unemployment: "https://des.nc.gov/employers/create-or-update-employer-account",
    note: "Withholding: NCDOR Online Business Registration (replaces paper NC-BR). UI: create employer account in NCSUITS via DES page.",
  },
  ND: {
    withholding: "https://tap.tax.nd.gov/",
    unemployment: "https://www.jobsnd.com/unemployment-business-tax/ui-easy",
    note: "Withholding: register via ND Taxpayer Access Point (TAP). UI: register through UI EASY at Job Service North Dakota.",
  },
  NE: {
    withholding: "https://revenue.nebraska.gov/businesses/register-your-new-business-online",
    unemployment: "https://dol.nebraska.gov/uitax",
    note: "UI account registration is completed through NEworks; dol.nebraska.gov/uitax has the instructions and entry point.",
  },
  NH: {
    withholding: null,
    unemployment: "https://www.nhes.nh.gov/services/employers/register.htm",
    note: "No state income tax on wages. UI: 'Register as a New NH Employer' with NH Employment Security (NHUIS system).",
  },
  NJ: {
    withholding: "https://www.njportal.com/DOR/BusinessRegistration",
    unemployment: "https://www.nj.gov/labor/ea/employer-services/who-qualifies/",
    combined: "https://www.njportal.com/DOR/BusinessRegistration",
    note: "One combined registration: filing NJ-REG online registers the withholding Taxpayer ID and the UI/Disability/Family Leave employer accounts with NJDOL.",
  },
  NM: {
    withholding: "https://tap.state.nm.us/tap/_/",
    unemployment: "https://ui.dws.nm.gov/Employer/Revenue/Registration/EmployerRegistration/RegisterEmployer.ASPX",
    note: "Withholding: 'Apply for a New Mexico Business Tax ID' on TAP. UI: NMDWS UI Tax Self-Service employer registration; dws.state.nm.us bot-blocks automated fetchers but loads in browsers.",
  },
  NV: {
    withholding: null,
    unemployment: "https://nui.nv.gov/ESS/_/",
    note: "No state income tax on wages. UI: register a new business via DETR's Employer Self Service (ESS) portal (landing page also at ui.nv.gov/ess.html). Nevada Modified Business Tax registration happens with the UI registration.",
  },
  NY: {
    withholding: "https://www.businessexpress.ny.gov/app/answers/cms/a_id/3033",
    unemployment: "https://dol.ny.gov/register-unemployment-insurance-0",
    combined: "https://www.businessexpress.ny.gov/app/answers/cms/a_id/3033",
    note: "One combined registration: NYS-100 via NY Business Express registers UI, withholding, and wage reporting together (online option is for general business employers; non-profit/government register by mail).",
  },
  OH: {
    withholding: "https://gateway.ohio.gov/",
    unemployment: "https://thesource.jfs.ohio.gov/employer.html",
    note: "Withholding via Ohio Business Gateway (select Employer Withholding registration); UI via The SOURCE (ODJFS).",
  },
  OK: {
    withholding: "https://oktap.tax.ok.gov/oktap/Web/_/",
    unemployment: "https://eztaxexpress.oesc.ok.gov/",
    note: "OkTAP 'Register for a Business' opens the withholding account; OESC EZ Tax Express opens the UI tax account. OkTAP may bot-block fetchers but loads in browsers.",
  },
  OR: {
    withholding: "https://www.oregon.gov/dor/programs/businesses/pages/withholding-and-payroll-tax.aspx",
    unemployment: "https://frances.oregon.gov/employer/_/",
    combined: "https://www.oregon.gov/dor/programs/businesses/pages/withholding-and-payroll-tax.aspx",
    note: "One Combined Employer's Registration (via Revenue Online) issues a single BIN covering withholding AND unemployment tax; Frances Online is the Employment Department system for UI/Paid Leave employer accounts.",
  },
  PA: {
    withholding: "https://mypath.pa.gov/",
    unemployment: "https://www.pa.gov/agencies/dli/programs-services/unemployment/for-employers/uc-tax-payment",
    combined: "https://mypath.pa.gov/",
    note: "PA Online Business Tax Registration on myPATH (replaced PA-100) registers both employer withholding (Revenue) and UC (Labor & Industry) in one application.",
  },
  RI: {
    withholding: "https://tax.ri.gov/online-services/register-your-business-online",
    unemployment: "https://dlt.ri.gov/employers/employer-tax-unit",
    combined: "https://www.ri.gov/taxation/BAR/",
    note: "RI Combined Online Registration (Business Application and Registration) opens withholding and DLT UI/TDI/JDF accounts in one process.",
  },
  SC: {
    withholding: "https://dor.sc.gov/tax/registration",
    unemployment: "https://uitax.dew.sc.gov/employers-page.html",
    note: "Withholding via MyDORWAY Business Tax Application (SCDOR); UI via SUITS (SC DEW).",
  },
  SD: {
    withholding: null,
    unemployment: "https://dlr.sd.gov/ra/businesses/registration.aspx",
    note: "No state income tax on wages. UI is called Reemployment Assistance (DLR).",
  },
  TN: {
    withholding: null,
    unemployment: "https://www.tn.gov/workforce/employers/tax-and-insurance-redirect/unemployment-insurance-tax.html",
    note: "No state income tax on wages. UI registration moved to Jobs4TN Employer e-Services (jobs4tn.gov) in May 2025, replacing TNPAWS; this page links to it.",
  },
  TX: {
    withholding: null,
    unemployment: "https://www.twc.texas.gov/services/register-tax",
    note: "No state income tax on wages. TWC Unemployment Tax Registration (UTR) online service.",
  },
  UT: {
    withholding: "https://osbr.utah.gov/",
    unemployment: "https://jobs.utah.gov/ui/employer/public/osbr.aspx",
    combined: "https://osbr.utah.gov/",
    note: "Utah OneStop Online Business Registration opens Tax Commission withholding and DWS UI accounts in one application.",
  },
  VA: {
    withholding: "https://www.tax.virginia.gov/register-business-virginia",
    unemployment: "https://www.vec.virginia.gov/tax-filing-registration",
    combined: "https://www.tax.virginia.gov/register-business-virginia",
    note: "Virginia Tax online business registration lets employers register with VEC for unemployment tax at the same time.",
  },
  VT: {
    withholding: "https://tax.vermont.gov/business/withholding",
    unemployment: "https://employerregistration.labor.vermont.gov/",
    note: "Withholding account (WHT) registered via myVTax (linked from this page); UI via VT Department of Labor Employer Registration application.",
  },
  WA: {
    withholding: null,
    unemployment: "https://dor.wa.gov/open-business/apply-business-license",
    combined: "https://dor.wa.gov/open-business/apply-business-license",
    note: "No state income tax on wages, but employers still register via the DOR Business License Application, which also opens ESD unemployment insurance and L&I workers' comp accounts (and other payroll programs).",
  },
  WI: {
    withholding: "https://tap.revenue.wi.gov/BTR",
    unemployment: "https://dwd.wisconsin.gov/uitax/register-business.htm",
    note: "Withholding via DOR Business Tax Registration (TAP); UI via DWD new employer registration.",
  },
  WV: {
    withholding: "https://tax.wv.gov/Business/BusinessRegistration/Pages/BusinessRegistration.aspx",
    unemployment: "https://workforcewv.org/businesses/unemployment-tax-information/navigate-the-unemployment-process/",
    combined: "https://business4.wv.gov/",
    note: "WV One Stop Business Portal registers with the Tax Division (withholding) and WorkForce WV (unemployment compensation) in one combined application.",
  },
  WY: {
    withholding: null,
    unemployment: "https://wyui.wyo.gov/",
    combined: "https://wyui.wyo.gov/",
    note: "No state income tax on wages. WYUI Joint Business Registration (DWS) opens both unemployment insurance and workers' compensation accounts.",
  },
};

export function registrationInfo(state: string): RegistrationInfo | undefined {
  return REGISTRATION_LINKS[state as StateCode];
}
