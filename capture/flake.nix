{
  description = "Living Code Herdr App native screenshot environment";
  inputs.nixpkgs.url = "github:NixOS/nixpkgs/6510408d147d8c5e6d76043e899e9251756f6a75";
  outputs = { nixpkgs, ... }: {
    devShells.x86_64-linux.default = let
      pkgs = import nixpkgs { system = "x86_64-linux"; };
      runtime = import ./runtime.nix { inherit pkgs; };
    in pkgs.mkShell {
      packages = with pkgs; [
        runtime.app runtime.core python3 git bash bat
        kitty xorg-server xdotool imagemagick dejavu_fonts
      ];
      CAPTURE_MESA = "${pkgs.mesa}";
      FONTCONFIG_FILE = pkgs.makeFontsConf { fontDirectories = [ pkgs.dejavu_fonts ]; };
    };
  };
}
