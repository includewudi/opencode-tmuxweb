import SwiftUI
import VoiceTmuxCore

struct TerminalContainerView: View {
    @ObservedObject var viewModel: AppViewModel
    @State private var selectedTab: Int = 0
    
    var body: some View {
        TabView(selection: $selectedTab) {
            TreeView(viewModel: viewModel)
                .tabItem {
                    Label("Sessions", systemImage: "list.bullet.indent")
                }
                .tag(0)
            
            if let transport = viewModel.transport {
                NavigationView {
                    XTermSSHView(transport: transport)
                        .navigationTitle("Terminal")
                        .navigationBarTitleDisplayMode(.inline)
                }
                .tabItem {
                    Label("Terminal", systemImage: "terminal")
                }
                .tag(1)
            }
            
            CaptureView(viewModel: viewModel)
                .tabItem {
                    Label("Capture", systemImage: "camera.viewfinder")
                }
                .tag(2)
        }
        .navigationBarBackButtonHidden(true)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button("Disconnect") {
                    Task {
                        await viewModel.disconnect()
                    }
                }
                .tint(.red)
            }
        }
    }
}
