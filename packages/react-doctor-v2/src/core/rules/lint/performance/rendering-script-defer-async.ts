import { defineRule } from "../../registry.js";
import { EXECUTABLE_SCRIPT_TYPES, SCRIPT_LOADING_ATTRIBUTES, isNodeOfType } from "./utils/index.js";
import type { EsTreeNode, Rule, RuleContext } from "./utils/index.js";

export const renderingScriptDeferAsync = defineRule<Rule>({
  recommendation:
    "Add defer, async, type=module, or a framework Script strategy to non-critical scripts so parsing is not blocked.",
  examples: [
    {
      before: `<script src="/analytics.js"></script>`,
      after: `<script src="/analytics.js" async></script>`,
    },
  ],
  create: (context: RuleContext) => ({
    JSXOpeningElement(node: EsTreeNode) {
      if (!isNodeOfType(node.name, "JSXIdentifier") || node.name.name !== "script") return;

      const attributes = node.attributes ?? [];
      const hasSrc = attributes.some(
        (attribute: EsTreeNode) =>
          isNodeOfType(attribute, "JSXAttribute") &&
          isNodeOfType(attribute.name, "JSXIdentifier") &&
          attribute.name.name === "src",
      );

      if (!hasSrc) return;

      const typeAttribute = attributes.find(
        (attribute: EsTreeNode) =>
          isNodeOfType(attribute, "JSXAttribute") &&
          isNodeOfType(attribute.name, "JSXIdentifier") &&
          attribute.name.name === "type",
      );
      const typeValue = isNodeOfType(typeAttribute?.value, "Literal")
        ? typeAttribute.value.value
        : null;
      if (typeof typeValue === "string" && !EXECUTABLE_SCRIPT_TYPES.has(typeValue)) return;
      if (typeValue === "module") return;

      const hasLoadingStrategy = attributes.some(
        (attribute: EsTreeNode) =>
          isNodeOfType(attribute, "JSXAttribute") &&
          isNodeOfType(attribute.name, "JSXIdentifier") &&
          SCRIPT_LOADING_ATTRIBUTES.has(attribute.name.name),
      );

      if (!hasLoadingStrategy) {
        context.report({
          node,
          message:
            "<script src> without defer or async - blocks HTML parsing and delays First Contentful Paint. Add defer for DOM-dependent scripts or async for independent ones",
        });
      }
    },
  }),
});
