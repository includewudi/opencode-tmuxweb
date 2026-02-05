// swift-tools-version: 5.9
// The swift-tools-version declares the minimum version of Swift required to build this package.

import PackageDescription

let package = Package(
    name: "VoiceTmuxCore",
    platforms: [
        .iOS(.v17),
        .macOS(.v14)
    ],
    products: [
        // Products define the executables and libraries a package produces, making them visible to other packages.
        .library(
            name: "VoiceTmuxCore",
            targets: ["VoiceTmuxCore"]),
    ],
    dependencies: [
        // Citadel for SSH
        .package(url: "https://github.com/orlandos-nl/Citadel.git", from: "0.9.0"),
        // Swift Crypto for advanced key types (PEM parsing)
        .package(url: "https://github.com/apple/swift-crypto.git", "2.0.0" ..< "4.0.0"),
    ],
    targets: [
        // Targets are the basic building blocks of a package, defining a module or a test suite.
        // Targets can depend on other targets in this package and products from dependencies.
        .target(
            name: "VoiceTmuxCore",
            dependencies: [
                .product(name: "Citadel", package: "Citadel"),
                .product(name: "Crypto", package: "swift-crypto"),
                .product(name: "_CryptoExtras", package: "swift-crypto"),
            ]
        ),
        .testTarget(
            name: "VoiceTmuxCoreTests",
            dependencies: ["VoiceTmuxCore"]),
    ]
)
