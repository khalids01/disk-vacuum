const repository = "khalids01/disk-vacuum";
const releasesUrl = `https://github.com/${repository}/releases/latest`;

const assetFor = (assets, matcher) =>
  assets.find((asset) => matcher.test(asset.name));
const setLinks = (selector, asset) => {
  if (!asset) return;
  document.querySelectorAll(selector).forEach((link) => {
    link.href = asset.browser_download_url;
  });
};

const platform = (() => {
  const value = `${navigator.userAgent} ${navigator.platform}`.toLowerCase();
  if (value.includes("mac")) return "mac";
  if (value.includes("win")) return "windows";
  if (value.includes("android")) return "android";
  if (value.includes("linux")) return "linux";
  return "unknown";
})();

async function hydrateRelease() {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${repository}/releases/latest`,
      {
        headers: { Accept: "application/vnd.github+json" },
      },
    );
    if (!response.ok) throw new Error(`GitHub returned ${response.status}`);
    const release = await response.json();
    const assets = release.assets ?? [];
    const appImage = assetFor(assets, /amd64\.AppImage$/i);
    const deb = assetFor(assets, /amd64\.deb$/i);
    const rpm = assetFor(assets, /x86_64\.rpm$/i);
    const macArm = assetFor(assets, /aarch64\.dmg$/i);
    const macIntel = assetFor(assets, /x64\.dmg$/i);
    const windowsExe = assetFor(assets, /x64-setup\.exe$/i);
    const windowsMsi = assetFor(assets, /x64_en-US\.msi$/i);

    setLinks(".js-linux-download", appImage);
    setLinks(".js-deb-download", deb);
    setLinks(".js-rpm-download", rpm);
    setLinks(".js-mac-arm-download", macArm);
    setLinks(".js-mac-intel-download", macIntel);
    setLinks(".js-windows-exe-download", windowsExe);
    setLinks(".js-windows-msi-download", windowsMsi);

    let preferred = appImage;
    let platformLabel = "for Linux";
    if (platform === "mac") {
      preferred = undefined;
      platformLabel = "— choose your Mac build";
    } else if (platform === "windows") {
      preferred = windowsExe ?? windowsMsi;
      platformLabel = "for Windows";
    } else if (platform === "android") {
      preferred = undefined;
      platformLabel = "— desktop builds available";
    }

    document.querySelectorAll(".js-primary-download").forEach((link) => {
      link.href =
        platform === "mac"
          ? "#download"
          : (preferred?.browser_download_url ?? releasesUrl);
      const small = link.querySelector("small");
      if (small)
        small.textContent = preferred
          ? `Download ${platformLabel}`
          : "View available builds";
    });
    document.querySelectorAll(".js-version").forEach((node) => {
      node.textContent = `${release.tag_name} available ${platformLabel}`;
    });
    document.querySelectorAll(".js-version-number").forEach((node) => {
      node.textContent = release.tag_name.replace(/^v/, "");
    });
  } catch {
    document.querySelectorAll(".js-version").forEach((node) => {
      node.textContent = "Latest release on GitHub";
    });
  }
}

const observer = new IntersectionObserver(
  (entries) =>
    entries.forEach(
      (entry) => entry.isIntersecting && entry.target.classList.add("visible"),
    ),
  { threshold: 0.08 },
);
document.querySelectorAll(".reveal").forEach((node) => observer.observe(node));

const menuButton = document.querySelector(".menu-button");
menuButton?.addEventListener("click", () => {
  const header = document.querySelector(".site-header");
  const open = header?.classList.toggle("menu-open") ?? false;
  menuButton.setAttribute("aria-expanded", String(open));
});
document.querySelectorAll(".site-header nav a").forEach((link) =>
  link.addEventListener("click", () => {
    document.querySelector(".site-header")?.classList.remove("menu-open");
    menuButton?.setAttribute("aria-expanded", "false");
  }),
);

hydrateRelease();
