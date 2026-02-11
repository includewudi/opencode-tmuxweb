import SwiftUI

@main
struct iTermProApp: App {
    @StateObject private var appVM = AppViewModel()
    
    var body: some Scene {
        WindowGroup {
            MainView(viewModel: appVM)
                .preferredColorScheme(.dark)
        }
    }
}
