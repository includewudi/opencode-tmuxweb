// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "TerminalCore",
    platforms: [.iOS(.v16), .macOS(.v14)],
    products: [
        .library(name: "TerminalCore", targets: ["TerminalCore"]),
    ],
    dependencies: [
        .package(url: "https://github.com/orlandos-nl/Citadel.git", from: "0.7.0"),
    ],
    targets: [
        .target(
            name: "TerminalCore",
            dependencies: ["Citadel"],
            path: "Sources"
        ),
    ]
)
