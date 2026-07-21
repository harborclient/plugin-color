import { installReact } from "@harborclient/sdk";
import type { PluginContext } from "@harborclient/sdk";
import { ColorPanel } from "./components/ColorPanel";

/**
 * Activates the Color plugin and registers the footer eyedropper panel.
 *
 * @param hc - Renderer plugin context from the HarborClient host.
 */
export function activate(hc: PluginContext): void {
  installReact(hc.react);

  /**
   * Footer panel host that closes over the plugin context.
   */
  function ColorPanelHost() {
    return <ColorPanel hc={hc} />;
  }

  hc.ui.registerFooterPanel({
    id: "panel",
    title: "🎨 Color",
    Component: ColorPanelHost,
  });
}
