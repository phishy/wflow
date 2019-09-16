import React, { useEffect, useState } from "react";
import "antd/dist/antd.css";
import "./App.css";

import axios from "axios";

import { Layout, Menu, PageHeader, Icon } from "antd";

const { SubMenu } = Menu;
const { Header, Content, Footer, Sider } = Layout;

function App() {
  const [run, setRun] = useState({
    event: {
      head_commit: {
        message: ""
      }
    },
    jobs: {
      build: {
        name: "",
        steps: [
          {
            name: "",
            run: ""
          }
        ]
      }
    }
  });

  useEffect(() => {
    axios.get(`http://localhost:3000${window.location.pathname}`).then(res => {
      let run = res.data;

      console.log(run);

      for (var jobName in run.jobs) {
        run.jobs[jobName].steps.forEach(step => {
          try {
            function updateScroll() {
              var element = document.getElementById("content");
              element.scrollTop = element.scrollHeight;
            }

            function connect() {
              step.ws = new WebSocket(step.realtime);
              step.ws.onmessage = function(event) {
                console.log(event.data);
                let content = document.getElementById("content");
                content.append(event.data);
                updateScroll();
              };
              step.ws.onclose = function(e) {
                console.log(
                  "Socket is closed. Reconnect will be attempted in 1 second.",
                  e.reason
                );
                setTimeout(function() {
                  connect();
                }, 1000);
              };
            }
            connect();
          } catch (e) {
            debugger;
          }
        });
      }

      setRun(res.data);
    });
  }, []);

  return (
    <Layout>
      <Header className="header">
        <h1
          style={{ color: "white", fontFamily: "Sacramento", fontSize: "40px" }}
        >
          Workflow
        </h1>
        <div className="logo" />
        <Menu
          theme="dark"
          mode="horizontal"
          defaultSelectedKeys={["2"]}
          style={{ lineHeight: "64px" }}
        >
          {/* <Menu.Item key="1">nav 1</Menu.Item>
          <Menu.Item key="2">nav 2</Menu.Item>
          <Menu.Item key="3">nav 3</Menu.Item> */}
        </Menu>
      </Header>
      <Content style={{ padding: "0 50px" }}>
        <PageHeader
          title={run.event.head_commit.message}
          subTitle={run.event.after}
        />
        <Layout style={{ padding: "24px 0", background: "#fff" }}>
          <Sider width={300} style={{ background: "#fff" }}>
            <Menu
              mode="inline"
              defaultSelectedKeys={["0"]}
              defaultOpenKeys={["sub1"]}
              style={{ height: "100%" }}
            >
              {Object.keys(run.jobs).map(jobName => (
                <SubMenu
                  key="sub1"
                  title={
                    <span>
                      <Icon type="sync" spin />
                      <b>{run.jobs[jobName].name || jobName }</b>
                    </span>
                  }
                >
                  {run.jobs[jobName].steps.map(step => (
                    <Menu.Item key={step.uses || step.name || step.run}>
                      <Icon
                        type="check-circle"
                        theme="twoTone"
                        twoToneColor="#52c41a"
                      />
                      {step.uses || step.name || step.run}
                    </Menu.Item>
                  ))}
                </SubMenu>
              ))}
            </Menu>
          </Sider>
          <Content
            id="content"
            style={{
              whiteSpace: "pre",
              fontFamily: "monospace",
              fontSize: "10px",
              backgroundColor: "black",
              color: "white",
              padding: "0 24px",
              minHeight: 280,
              overflow: "scroll",
              height: "500px"
            }}
          ></Content>
        </Layout>
      </Content>
      <Footer style={{ textAlign: "center" }}>©2019 @phishy</Footer>
    </Layout>
  );
}

export default App;
