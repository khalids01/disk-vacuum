use crate::features::scan::model::{DeveloperArtifactKind, LargeFileSafety};

#[derive(Clone, Copy)]
pub struct ArtifactDetection {
    pub kind: DeveloperArtifactKind,
    pub safety: LargeFileSafety,
    pub explanation: &'static str,
    pub regeneration: &'static str,
}

pub fn is_candidate_name(name: &str) -> bool {
    matches!(
        name.to_ascii_lowercase().as_str(),
        "node_modules"
            | "target"
            | ".venv"
            | "venv"
            | "__pycache__"
            | ".next"
            | ".nuxt"
            | ".svelte-kit"
            | ".turbo"
            | ".parcel-cache"
            | "dist"
            | "build"
            | "out"
            | "coverage"
            | ".pytest_cache"
            | ".mypy_cache"
            | ".ruff_cache"
            | ".tox"
            | ".npm"
            | "yarn"
            | "store"
            | "cache"
    )
}

pub fn detect_artifact(
    name: &str,
    path: &str,
    sibling_names: &[String],
) -> Option<ArtifactDetection> {
    let name = name.to_ascii_lowercase();
    let path = path.replace('\\', "/").to_ascii_lowercase();
    let has = |marker: &str| sibling_names.iter().any(|value| value == marker);
    let node_project = has("package.json")
        || has("bun.lock")
        || has("bun.lockb")
        || has("package-lock.json")
        || has("pnpm-lock.yaml")
        || has("yarn.lock");
    let python_project = has("pyproject.toml")
        || has("requirements.txt")
        || has("setup.py")
        || has("setup.cfg")
        || has("pipfile");

    if [
        "/.nvm/",
        "/.volta/",
        "/.asdf/",
        "/.sdkman/",
        "/.rustup/",
        "/.pyenv/",
    ]
    .iter()
    .any(|part| path.contains(part))
    {
        return None;
    }

    let likely_safe = LargeFileSafety::LikelySafe;
    let detected = match name.as_str() {
        "node_modules" if node_project => ArtifactDetection {
            kind: DeveloperArtifactKind::NodeModules,
            safety: likely_safe,
            explanation: "Installed Node.js dependencies.",
            regeneration: "Restore with the project's package-manager install command.",
        },
        "target" if has("cargo.toml") => ArtifactDetection {
            kind: DeveloperArtifactKind::RustTarget,
            safety: likely_safe,
            explanation: "Rust compiler output for a Cargo project.",
            regeneration: "Cargo rebuilds it the next time the project is compiled.",
        },
        ".venv" | "venv" if name == ".venv" || python_project => ArtifactDetection {
            kind: DeveloperArtifactKind::PythonVirtualEnvironment,
            safety: LargeFileSafety::Review,
            explanation: "A project-local Python virtual environment.",
            regeneration: "Recreate it and reinstall the project's Python dependencies.",
        },
        "__pycache__" => ArtifactDetection {
            kind: DeveloperArtifactKind::PythonCache,
            safety: likely_safe,
            explanation: "Python bytecode cache.",
            regeneration: "Python recreates it when modules run again.",
        },
        ".pytest_cache" | ".mypy_cache" | ".ruff_cache" | ".tox" => ArtifactDetection {
            kind: DeveloperArtifactKind::TemporaryBuildOutput,
            safety: likely_safe,
            explanation: "Generated test or developer-tool state.",
            regeneration: "The corresponding developer tool recreates it when needed.",
        },
        ".next" | ".nuxt" | ".svelte-kit" | ".turbo" | ".parcel-cache" | "coverage"
            if node_project =>
        {
            ArtifactDetection {
                kind: DeveloperArtifactKind::BuildOutput,
                safety: likely_safe,
                explanation: "Generated frontend build or tool output.",
                regeneration: "The project's build or test command recreates it.",
            }
        }
        "dist" | "build" | "out" if node_project || python_project || has("cargo.toml") => {
            ArtifactDetection {
                kind: DeveloperArtifactKind::BuildOutput,
                safety: likely_safe,
                explanation: "Generated project build output.",
                regeneration: "The project build command recreates it.",
            }
        }
        ".npm" if path.ends_with("/.npm") => ArtifactDetection {
            kind: DeveloperArtifactKind::PackageCache,
            safety: likely_safe,
            explanation: "npm's downloaded package cache.",
            regeneration: "npm downloads required packages again on demand.",
        },
        "yarn" if path.ends_with("/.cache/yarn") => ArtifactDetection {
            kind: DeveloperArtifactKind::PackageCache,
            safety: likely_safe,
            explanation: "Yarn's downloaded package cache.",
            regeneration: "Yarn downloads required packages again on demand.",
        },
        "store" if path.contains("/pnpm/") && path.ends_with("/store") => ArtifactDetection {
            kind: DeveloperArtifactKind::PackageCache,
            safety: likely_safe,
            explanation: "pnpm's shared package store.",
            regeneration: "pnpm downloads required packages again on demand.",
        },
        "cache" if path.ends_with("/.bun/install/cache") => ArtifactDetection {
            kind: DeveloperArtifactKind::PackageCache,
            safety: likely_safe,
            explanation: "Bun's downloaded package cache.",
            regeneration: "Bun downloads required packages again on demand.",
        },
        _ => return None,
    };
    Some(detected)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn siblings(values: &[&str]) -> Vec<String> {
        values.iter().map(|value| (*value).to_owned()).collect()
    }

    #[test]
    fn generic_build_and_target_directories_require_project_markers() {
        assert!(detect_artifact("target", "/photos/target", &[]).is_none());
        assert!(detect_artifact("build", "/documents/build", &[]).is_none());
        assert!(
            detect_artifact("target", "/code/app/target", &siblings(&["cargo.toml"])).is_some()
        );
        assert!(
            detect_artifact("build", "/code/app/build", &siblings(&["package.json"])).is_some()
        );
    }

    #[test]
    fn recognizes_cross_platform_package_cache_paths() {
        assert!(detect_artifact(".npm", "/home/me/.npm", &[]).is_some());
        assert!(detect_artifact("yarn", "/Users/me/.cache/yarn", &[]).is_some());
        assert!(detect_artifact("cache", "C:\\Users\\me\\.bun\\install\\cache", &[]).is_some());
    }

    #[test]
    fn virtual_environments_are_conservative() {
        let item = detect_artifact(".venv", "/code/app/.venv", &[]).unwrap();
        assert_eq!(item.safety, LargeFileSafety::Review);
        assert!(detect_artifact("venv", "/documents/venv", &[]).is_none());
    }
    #[test]
    fn protects_managed_runtimes_and_requires_project_markers() {
        assert!(detect_artifact(
            "node_modules",
            "/home/me/.nvm/versions/node/v24/lib/node_modules",
            &siblings(&["package.json"])
        )
        .is_none());
        assert!(detect_artifact("node_modules", "/tmp/random/node_modules", &[]).is_none());
        assert_eq!(
            detect_artifact(
                "node_modules",
                "/code/app/node_modules",
                &siblings(&["package.json"])
            )
            .unwrap()
            .safety,
            LargeFileSafety::LikelySafe
        );
    }
}
