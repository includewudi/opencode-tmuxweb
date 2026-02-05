import SwiftUI

@main
struct VoiceTmuxApp: App {
    @StateObject private var viewModel = AppViewModel()
    
    var body: some Scene {
        WindowGroup {
            TreeView(viewModel: viewModel)
                .sheet(isPresented: $viewModel.showConnectionSheet) {
                    ConnectionSettingsView(viewModel: viewModel)
                        .interactiveDismissDisabled(viewModel.connectionState == .disconnected)
                }
                .onAppear {
                    Task {
                        await viewModel.autoConnect()
                    }
                }
        }
    }
}
