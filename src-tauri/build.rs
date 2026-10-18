fn main() {
    #[cfg(all(target_os = "windows", target_env = "msvc"))]
    {
        // tauri-winres normally embeds this only in the app binary. The test
        // harness also links Common Controls v6 and must receive the manifest.
        // https://github.com/tauri-apps/tauri/issues/13419
        let manifest = std::path::PathBuf::from(
            std::env::var_os("CARGO_MANIFEST_DIR").expect("Cargo manifest directory"),
        )
        .join("windows-app-manifest.xml");
        println!("cargo:rerun-if-changed={}", manifest.display());
        println!("cargo:rustc-link-arg=/MANIFEST:EMBED");
        println!("cargo:rustc-link-arg=/MANIFESTINPUT:{}", manifest.display());
        let attributes = tauri_build::Attributes::new()
            .windows_attributes(tauri_build::WindowsAttributes::new_without_app_manifest());
        tauri_build::try_build(attributes).expect("Tauri Windows build");
    }
    #[cfg(not(all(target_os = "windows", target_env = "msvc")))]
    tauri_build::build();
}
