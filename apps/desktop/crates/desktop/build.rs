#[cfg(windows)]
fn main() {
    use image::{imageops::FilterType, ImageFormat};
    use std::{env, fs, path::PathBuf};

    println!("cargo:rerun-if-changed=assets/app-icon.png");

    let out_dir = PathBuf::from(env::var("OUT_DIR").expect("OUT_DIR is set by Cargo"));
    let icon_path = out_dir.join("app-icon.ico");
    let rc_path = out_dir.join("app-icon.rc");

    image::open("assets/app-icon.png")
        .expect("failed to open application icon")
        .resize_exact(256, 256, FilterType::Lanczos3)
        .save_with_format(&icon_path, ImageFormat::Ico)
        .expect("failed to write Windows icon");

    let escaped_icon_path = icon_path.display().to_string().replace('\\', "\\\\");
    fs::write(&rc_path, format!("1 ICON \"{escaped_icon_path}\"\n"))
        .expect("failed to write Windows resource file");

    embed_resource::compile(&rc_path, embed_resource::NONE)
        .manifest_optional()
        .expect("failed to embed Windows resources");
}

#[cfg(not(windows))]
fn main() {
    println!("cargo:rerun-if-changed=assets/app-icon.png");
}
