# Official release binaries, hash-pinned and adapted to Nix. Capture-only;
# end users install JSON themes, not this maintenance environment.
{ pkgs }:
let
  core = pkgs.stdenvNoCC.mkDerivation {
    pname = "herdr-core";
    version = "0.1.16";
    src = pkgs.fetchurl {
      url = "https://releases.herdr.dev/core/0.1.16/herdr-core-linux-x86_64.tar.gz";
      hash = "sha256-WNaGEXbcb+kFtYiA1b/weplZvmE6mOXWa0WDsEts+kU=";
    };
    sourceRoot = ".";
    nativeBuildInputs = [ pkgs.makeWrapper ];
    dontConfigure = true;
    dontBuild = true;
    dontStrip = true;
    installPhase = ''
      runHook preInstall
      install -Dm755 herdr-core $out/bin/herdr-core
      install -Dm644 LICENSE $out/share/licenses/herdr-core/LICENSE
      install -Dm644 THIRD-PARTY-NOTICES $out/share/licenses/herdr-core/THIRD-PARTY-NOTICES
      wrapProgram $out/bin/herdr-core --prefix PATH : ${pkgs.lib.makeBinPath [ pkgs.bash pkgs.curl pkgs.openssh pkgs.systemd ]}
      ln -s herdr-core $out/bin/hc
      runHook postInstall
    '';
    meta = {
      license = pkgs.lib.licenses.asl20;
      platforms = [ "x86_64-linux" ];
      sourceProvenance = [ pkgs.lib.sourceTypes.binaryNativeCode ];
    };
  };
  app = pkgs.stdenvNoCC.mkDerivation {
    pname = "herdr-app";
    version = "0.1.11";
    src = pkgs.fetchurl {
      url = "https://releases.herdr.dev/app/0.1.11/herdr-app-linux-x86_64.tar.gz";
      hash = "sha256-Ro/zFqJvxMLGOPEMWNLeNTyCXKxNhG+iVMYSlBQXRKM=";
    };
    nativeBuildInputs = [ pkgs.autoPatchelfHook pkgs.makeWrapper ];
    buildInputs = [ pkgs.stdenv.cc.cc.lib pkgs.libxcb pkgs.libxkbcommon ];
    runtimeDependencies = map pkgs.lib.getLib [ pkgs.libglvnd pkgs.vulkan-loader pkgs.wayland ];
    dontConfigure = true;
    dontBuild = true;
    dontStrip = true;
    installPhase = ''
      runHook preInstall
      install -Dm755 herdr-app $out/bin/herdr-app
      # No sibling SVG: upstream's folder-based self-updater stays disabled.
      install -Dm644 herdr-app.svg $out/share/icons/hicolor/scalable/apps/herdr-app.svg
      install -Dm644 LICENSE $out/share/licenses/herdr-app/LICENSE
      install -Dm644 THIRD-PARTY-NOTICES $out/share/licenses/herdr-app/THIRD-PARTY-NOTICES
      wrapProgram $out/bin/herdr-app --prefix PATH : ${pkgs.lib.makeBinPath [ core pkgs.curl pkgs.xdg-utils ]} --set HERDR_TELEMETRY 0
      runHook postInstall
    '';
    meta = {
      license = pkgs.lib.licenses.asl20;
      platforms = [ "x86_64-linux" ];
      sourceProvenance = [ pkgs.lib.sourceTypes.binaryNativeCode ];
    };
  };
in
{ inherit app core; }
