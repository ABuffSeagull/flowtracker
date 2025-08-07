module Main exposing (..)

import Browser
import Browser.Events
import Browser.Navigation as Navigation
import Element exposing (..)
import Element.Input as Input
import Html
import Html.Attributes
import Task
import Time
import Tuple
import Url


main : Program { width : Int, height : Int } Model Msg
main =
    Browser.application
        { init = init
        , onUrlChange = onUrlChange
        , onUrlRequest = onUrlRequest
        , subscriptions = subscriptions
        , update = update
        , view = view
        }


type alias Model =
    { finishedTasks : List FinishedTask
    , now : Time.Posix
    , currentTask : TaskMode
    , device : Device
    }


type TaskMode
    = Creating { name : String }
    | Running { name : String, start : Time.Posix }


type alias FinishedTask =
    { name : String
    , start : Time.Posix
    , end : Time.Posix
    , interrupted : Bool
    , breakTime : Duration
    }


init : { width : Int, height : Int } -> Url.Url -> Navigation.Key -> ( Model, Cmd Msg )
init flags _ _ =
    ( { finishedTasks = []
      , now = Time.millisToPosix 0
      , currentTask = Creating { name = "" }
      , device = classifyDevice flags
      }
    , Cmd.none
    )


type Msg
    = NoOp
    | Tick Time.Posix
    | InitiateStart
    | StartTask Time.Posix
    | UpdateTaskName String
    | InitiateFinish
    | FinishTask Time.Posix
    | ResizeWindow Int Int


onUrlChange : a -> Msg
onUrlChange _ =
    NoOp


onUrlRequest : Browser.UrlRequest -> Msg
onUrlRequest _ =
    NoOp


subscriptions : Model -> Sub Msg
subscriptions _ =
    Sub.batch
        [ Time.every 1000 Tick
        , Browser.Events.onResize ResizeWindow
        ]


update : Msg -> Model -> ( Model, Cmd Msg )
update msg model =
    case ( msg, model.currentTask ) of
        ( Tick now, _ ) ->
            ( { model | now = now }, Cmd.none )

        ( ResizeWindow width height, _ ) ->
            ( { model | device = classifyDevice { width = width, height = height } }, Cmd.none )

        ( InitiateStart, Creating _ ) ->
            ( model, Task.perform StartTask Time.now )

        ( StartTask start, Creating task ) ->
            ( { model | currentTask = Running { name = task.name, start = start } }, Cmd.none )

        ( UpdateTaskName newName, Creating task ) ->
            let
                newTask =
                    { task | name = newName }
            in
            ( { model | currentTask = Creating newTask }, Cmd.none )

        ( UpdateTaskName _, Running _ ) ->
            -- Debug.todo "Should this be done?"
            ( model, Cmd.none )

        ( InitiateFinish, Running _ ) ->
            ( model, Task.perform FinishTask Time.now )

        ( FinishTask end, Running task ) ->
            let
                workDuration =
                    makeDuration task.start end
            in
            ( { model
                | finishedTasks =
                    { name = task.name
                    , start = task.start
                    , end = end
                    , interrupted = False
                    , breakTime = workToBreak workDuration
                    }
                        :: model.finishedTasks
                , currentTask = Creating { name = "" }
              }
            , Cmd.none
            )

        -- msgs in wrong models
        ( NoOp, _ ) ->
            ( model, Cmd.none )

        ( InitiateStart, Running _ ) ->
            ( model, Cmd.none )

        ( StartTask _, Running _ ) ->
            ( model, Cmd.none )

        ( InitiateFinish, Creating _ ) ->
            ( model, Cmd.none )

        ( FinishTask _, Creating _ ) ->
            ( model, Cmd.none )


size =
    modular 16 1.25 >> round


classifyDevice : { window | height : Int, width : Int } -> Device
classifyDevice window =
    -- Tested in this ellie:
    -- https://ellie-app.com/68QM7wLW8b9a1
    { class =
        let
            longSide =
                max window.width window.height

            shortSide =
                min window.width window.height
        in
        if shortSide <= 550 then
            Phone

        else if longSide <= 1100 then
            Tablet

        else if longSide <= 1500 then
            Desktop

        else
            BigDesktop
    , orientation =
        if window.width < window.height then
            Portrait

        else
            Landscape
    }


container device =
    case device.class of
        Phone ->
            width fill

        Tablet ->
            fill |> maximum 550 |> width

        Desktop ->
            fill |> maximum 1100 |> width

        BigDesktop ->
            fill |> maximum 1500 |> width


view : Model -> Browser.Document Msg
view model =
    { title = "Timer"
    , body =
        List.singleton <|
            layout [ padding (size 1) ] <|
                column
                    [ height fill, container model.device, centerX, spacing (size 5) ]
                    [ case model.currentTask of
                        Creating task ->
                            column [ centerX, spacing 10 ]
                                [ Input.text []
                                    { text = task.name
                                    , placeholder = Nothing
                                    , label = Input.labelAbove [] (text "Task name")
                                    , onChange = UpdateTaskName
                                    }
                                , Input.button [] { onPress = Just InitiateStart, label = text "Start task" }
                                ]

                        Running task ->
                            column [ centerX, spacing 10 ]
                                [ el [ centerX ] (text task.name)
                                , viewTimer task.start model.now
                                , Input.button [ centerX ] { onPress = Just InitiateFinish, label = text "Finish task" }
                                ]
                    , viewFinishedTasks model.finishedTasks
                    ]
    }


viewFinishedTasks tasks =
    table [ width fill, height fill, scrollbarY, spacing (size 3) ]
        { data = tasks
        , columns =
            [ { header = text "Name"
              , width = fill
              , view = .name >> text
              }
            , { header = text "Start"
              , width = fill
              , view = .start >> viewPosix
              }
            , { header = text "End"
              , width = fill
              , view = .end >> viewPosix
              }
            , { header = text "Duration"
              , width = fill
              , view = \task -> makeDuration task.start task.end |> viewDuration
              }
            , { header = text "Interrupted?"
              , width = fill
              , view =
                    \task ->
                        if task.interrupted then
                            text "Yes"

                        else
                            text "No"
              }
            , { header = text "Break duration"
              , width = fill
              , view = \task -> makeDuration task.start task.end |> workToBreak |> viewDuration
              }
            ]
        }


viewPosix posix =
    html <|
        Html.node
            "format-instant"
            [ Html.Attributes.attribute "instant" (posix |> Time.posixToMillis |> String.fromInt) ]
            []


viewTimer start now =
    viewDuration (makeDuration start now)


type Duration
    = Duration Int


makeDuration start end =
    Duration <|
        Time.posixToMillis end
            - Time.posixToMillis start


makeDurationRaw =
    Duration


viewDuration (Duration duration) =
    html <|
        Html.node
            "format-duration"
            [ Html.Attributes.attribute "duration" (String.fromInt duration) ]
            []


workToBreak (Duration duration) =
    let
        minuteToMillis =
            (*) 60 >> (*) 1000

        mapping =
            List.map
                (Tuple.mapBoth minuteToMillis minuteToMillis)
                [ ( 25, 3 )
                , ( 40, 5 )
                , ( 60, 7 )
                , ( 80, 10 )
                , ( 24 * 60, 15 )
                ]

        possibleBreaks =
            List.filterMap
                (\( work, break ) ->
                    if duration >= work then
                        Just break

                    else
                        Nothing
                )
                mapping

        maxBreak =
            List.maximum possibleBreaks
                |> Maybe.withDefault 180000
    in
    Duration maxBreak
