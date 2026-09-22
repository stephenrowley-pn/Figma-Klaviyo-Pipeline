import bodyText from "../fixtures/mapping-rules/body-text.json" with { type: "json" };
import footerDivider from "../fixtures/mapping-rules/footer-divider.json" with { type: "json" };
import headlineText from "../fixtures/mapping-rules/headline-text.json" with { type: "json" };
import heroButton from "../fixtures/mapping-rules/hero-button.json" with { type: "json" };
import heroImage from "../fixtures/mapping-rules/hero-image.json" with { type: "json" };
import productCardButton from "../fixtures/mapping-rules/product-card-button.json" with {
  type: "json",
};
import { type MappingRule, MappingRuleSchema } from "./mapping-rule.js";

/**
 * The six handwritten `MappingRule` fixtures, parsed and validated eagerly
 * so an invalid fixture fails at import time rather than inside a test.
 */
export const MAPPING_RULE_FIXTURES: readonly MappingRule[] = [
  heroButton,
  heroImage,
  bodyText,
  headlineText,
  footerDivider,
  productCardButton,
].map((raw) => MappingRuleSchema.parse(raw));
