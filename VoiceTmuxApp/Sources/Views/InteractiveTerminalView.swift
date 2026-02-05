import SwiftUI
import VoiceTmuxCore

struct InteractiveTerminalView: View {
    let pane: TmuxPane
    @ObservedObject var viewModel: AppViewModel
    
    var body: some View {
        ZStack {
            Color.black.edgesIgnoringSafeArea(.all)
            
            VStack {
                Text("Interactive Terminal (iOS 18+)")
                    .foregroundStyle(.white)
                    .font(.headline)
                Text("Pane: \(pane.id)")
                    .foregroundStyle(.gray)
                
                // Placeholder for XTermSSHView
                // XTermSSHView(viewModel: viewModel, pane: pane)
            }
            
            VoiceControlView { text in
                Task {
                    let cmd = TmuxCommandBuilder.sendKeys(target: pane.id, keys: text)
                    try? await viewModel.transport.execute(command: cmd)
                }
            }
            .frame(maxHeight: .infinity, alignment: .bottom)
            .padding()
        }
    }
}
