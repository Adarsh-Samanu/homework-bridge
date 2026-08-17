/**
 * Curated method differences between US elementary math and how the same
 * operations are taught elsewhere.
 *
 * This file is the actual substance of the project. A general-purpose model
 * knows these differences exist but states them vaguely and inconsistently;
 * grounding the prompt in specific, checkable facts is what makes the
 * side-by-side comparison trustworthy enough to hand a real parent.
 *
 * Every entry here is a difference in *method or notation*, not vocabulary —
 * translation already handles vocabulary.
 */

export interface CountryProfile {
  code: string;
  name: string;
  /** Languages commonly spoken by parents schooled here. */
  languages: string[];
  /** Notation differences that cause silent misreadings. */
  notation: string[];
  /** Method differences, keyed by the US topic they collide with. */
  methods: Record<string, string>;
  /** What grades are called locally. */
  gradeNaming: string;
  /** Local mnemonic for order of operations, if different from PEMDAS. */
  orderOfOperations: string;
}

export const COUNTRY_PROFILES: CountryProfile[] = [
  {
    code: "MX",
    name: "Mexico / Central America",
    languages: ["es"],
    notation: [
      "Decimal separator is a comma, not a period: 3,5 means three and a half. A parent may read the US '3.5' as thirty-five.",
      "Thousands are separated by a space or period: 1 000 or 1.000, not 1,000.",
      "Division is written with a different layout entirely — see the division method note.",
    ],
    methods: {
      "long division":
        "The divisor is written to the RIGHT of the dividend, separated by a vertical bar, and the quotient is written UNDERNEATH the divisor — not above a bracket as in the US. The arithmetic is identical; only the placement differs. Parents often think the US layout is a different operation.",
      "multiplication":
        "Taught as the standard column algorithm from the start. The US 'box method' / 'area model' / 'partial products' is not used and looks like an unrelated grid puzzle to a parent.",
      "subtraction with regrouping":
        "Commonly taught as 'equal additions' (llevar) — add ten to the top digit and one to the next bottom digit — rather than the US 'borrow and cross out'. The written work looks completely different even though the answer matches.",
    },
    gradeNaming: "Called 'primero de primaria', 'segundo de primaria', etc.",
    orderOfOperations: "Same rules, but usually taught without the PEMDAS acronym.",
  },
  {
    code: "IN",
    name: "India",
    languages: ["hi", "te", "ta", "gu", "bn", "mr", "pa", "ml", "kn", "ur"],
    notation: [
      "Large numbers use the lakh/crore system with different comma placement: 1,00,000 is one lakh (100,000). US grouping of 100,000 looks wrong to a parent, and vice versa.",
      "Decimal separator is a period, same as the US — this one matches.",
    ],
    methods: {
      "long division":
        "Layout is close to the US bracket, but the subtraction steps are often done mentally and not written down. A US worksheet demanding every step be shown looks like busywork to a parent who was taught to compress them.",
      multiplication:
        "Standard column algorithm, taught earlier than in the US, with multiplication tables memorized to 20 rather than 12. The US 'area model' is unfamiliar; parents often skip straight to the answer and cannot explain the intermediate boxes the worksheet requires.",
      "number bonds":
        "No direct equivalent. The underlying idea (decomposing a number into parts) is taught, but never as a named diagram, so the term is untranslatable rather than merely unfamiliar.",
    },
    gradeNaming: "Called 'Class 3' or 'Standard 3' rather than '3rd grade'.",
    orderOfOperations: "BODMAS (Brackets, Order, Division, Multiplication, Addition, Subtraction) — same rules as PEMDAS, different acronym.",
  },
  {
    code: "VN",
    name: "Vietnam",
    languages: ["vi"],
    notation: [
      "Decimal separator is a comma; thousands use a period. 1.234,5 is one thousand two hundred thirty-four and a half.",
    ],
    methods: {
      "long division":
        "Uses the French-style layout: divisor to the right, quotient below it. Same arithmetic, different geometry on the page.",
      multiplication:
        "Standard column algorithm. Strong emphasis on mental arithmetic and speed; the US emphasis on showing multiple solution strategies can read as inefficiency rather than depth.",
    },
    gradeNaming: "Called 'lớp 1', 'lớp 2', etc. — closely matches US grade numbering.",
    orderOfOperations: "Same rules, no acronym.",
  },
  {
    code: "CN",
    name: "China",
    languages: ["zh"],
    notation: [
      "Decimal separator is a period, same as the US.",
      "Large numbers are grouped in ten-thousands (万) rather than thousands, so 50,000 is naturally read as 'five 万'.",
    ],
    methods: {
      multiplication:
        "Column algorithm, with tables memorized via the 九九表 (nine-nine song) — a different memorization structure than US times tables, though the same facts.",
      "long division":
        "Layout resembles the US bracket. This is one of the closer matches.",
    },
    gradeNaming: "Called '一年级', '二年级' — matches US numbering.",
    orderOfOperations: "Same rules, no acronym.",
  },
  {
    code: "BR",
    name: "Brazil",
    languages: ["pt"],
    notation: [
      "Decimal separator is a comma; thousands use a period. 1.234,56.",
    ],
    methods: {
      "long division":
        "Divisor to the right with the quotient below, like Mexico and Vietnam. Not the US bracket.",
      subtraction:
        "Equal-additions method is common rather than US-style borrowing.",
    },
    gradeNaming: "Called 'ano' (1º ano, 2º ano).",
    orderOfOperations: "Same rules, no acronym.",
  },
  {
    code: "PH",
    name: "Philippines",
    languages: ["tl", "ceb"],
    notation: [
      "Decimal separator is a period and thousands use a comma — matches the US, since the school system is US-derived.",
    ],
    methods: {
      multiplication:
        "Column algorithm taught directly. Newer US reform methods (area model, partial products) are still unfamiliar even though the notation matches.",
    },
    gradeNaming: "Matches US grade numbering.",
    orderOfOperations: "PEMDAS or MDAS — closely matches US.",
  },
];

export function findProfile(code: string): CountryProfile | null {
  return COUNTRY_PROFILES.find((p) => p.code === code) ?? null;
}
