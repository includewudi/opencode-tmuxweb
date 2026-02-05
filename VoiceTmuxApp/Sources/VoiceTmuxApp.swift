import SwiftUI

@main
struct VoiceTmuxApp: App {
    @StateObject private var viewModel = AppViewModel()
    
    var body: some Scene {
        WindowGroup {
            MainView(viewModel: viewModel)
        }
    }
}
